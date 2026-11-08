import { describe, it, expect } from "vitest";
import { CARDS, CARD_TYPES, T, type CardType } from "../cards";
import { createDeck, deal } from "../deck";
import {
  applyAction,
  newGame,
  commandFor,
  viewFor,
  cardCounts,
  allCards,
  decisionPlayerId,
  type GameState,
  type Move,
} from "../game-engine";
import { chooseMove } from "../bots";
import {
  saveGame,
  loadGame,
  isGameState,
  GAME_KEY,
  LEGACY_GAME_KEY,
} from "../storage";
const seed = (n: number) => () => {
  n = (n * 1664525 + 1013904223) >>> 0;
  return n / 4294967296;
};
const game = (players = 3) =>
  newGame({ mode: "bots", players, difficulty: "hard" }, seed(7));
function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}
// Переставляем реальные экземпляры, сохраняя все 56 ID.
function hand(s: GameState, player: number, types: CardType[]) {
  s.known = {};
  s.deck.push(...s.players[player].hand.splice(0));
  for (const type of types) {
    const collections = [
      s.deck,
      ...s.players.filter((_, i) => i !== player).map((p) => p.hand),
    ];
    const source = collections.find((cards) =>
      cards.some((c) => c.type === type),
    );
    if (!source) throw new Error("Нет тестового экземпляра " + type);
    s.players[player].hand.push(
      source.splice(
        source.findIndex((c) => c.type === type),
        1,
      )[0],
    );
  }
  return s.players[player].hand;
}
function first(s: GameState, type: CardType) {
  s.known = {};
  const i = s.deck.findIndex((c) => c.type === type);
  if (i < 0) throw new Error("Нет карты в колоде");
  s.deck.unshift(s.deck.splice(i, 1)[0]);
}
function act(s: GameState, move: Move) {
  const r = applyAction(s, commandFor(s, move), seed(42));
  expect(r.error).toBeUndefined();
  return r.state;
}
function passes(s: GameState) {
  let n = 0;
  while (s.pending?.kind === "nope") {
    s = act(s, { type: "pass" });
    if (++n > 10) throw new Error("Окно не закрылось");
  }
  return s;
}
function begin(s: GameState, type: CardType) {
  let card = s.players[s.active].hand.find((c) => c.type === type);
  if (!card) {
    hand(s, s.active, [...s.players[s.active].hand.map((c) => c.type), type]);
    card = s.players[s.active].hand.find((c) => c.type === type)!;
  }
  return act(s, { type: "play", cardId: card.id });
}
function play(s: GameState, type: CardType) {
  return passes(begin(s, type));
}
function combo(s: GameState, type: CardType, count: 2 | 3) {
  hand(s, s.active, Array(count).fill(type));
  return act(s, {
    type: "combo",
    cardIds: s.players[s.active].hand.map((c) => c.id),
  });
}
function valid(s: GameState) {
  expect(allCards(s)).toHaveLength(56);
  expect(new Set(allCards(s).map((c) => c.id)).size).toBe(56);
  expect(isGameState(s)).toBe(true);
}
describe("56 карт, 13 типов, подготовка", () => {
  it("все количества, канонические ID и уникальные экземпляры", () => {
    const deck = createDeck();
    expect(CARD_TYPES).toHaveLength(13);
    expect(deck).toHaveLength(56);
    expect(new Set(deck.map((c) => c.id)).size).toBe(56);
    for (const type of CARD_TYPES)
      expect(deck.filter((c) => c.type === type)).toHaveLength(
        CARDS[type].count,
      );
    expect(CARDS[T.nope].effect).toBe("NOPE");
    expect(CARDS[T.attack].effect).toBe("ATTACK");
  });
  for (const n of [2, 3, 4, 5])
    it(`раздача для ${n}: восемь карт, взрывы и исключённые экземпляры`, () => {
      const { hands, deck, excluded } = deal(n, seed(n));
      for (const cards of hands) {
        expect(cards).toHaveLength(8);
        expect(cards.filter((c) => c.type === T.defuse)).toHaveLength(1);
        expect(cards.some((c) => c.type === T.danger)).toBe(false);
      }
      expect(deck.filter((c) => c.type === T.danger)).toHaveLength(n - 1);
      expect(deck.filter((c) => c.type === T.defuse)).toHaveLength(
        Math.min(2, 6 - n),
      );
      expect(excluded.filter((c) => c.type === T.defuse)).toHaveLength(
        Math.max(0, 4 - n),
      );
      expect(excluded.filter((c) => c.type === T.danger)).toHaveLength(5 - n);
      expect([...hands.flat(), ...deck, ...excluded]).toHaveLength(56);
      valid(game(n));
    });
  it("недопустимые числа игроков отклоняются", () => {
    for (const n of [1, 6, 2.5]) expect(() => deal(n)).toThrow();
  });
});
describe("ход, взрыв, защита", () => {
  it("взятие обычной карты завершает ход без добора до восьми", () => {
    let s = game();
    hand(s, 0, []);
    first(s, T.skip);
    s = act(s, { type: "draw" });
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.active).toBe(1);
    valid(s);
  });
  it("нет ограничения размера руки", () => {
    const s = game();
    hand(
      s,
      0,
      Array(5).fill(T.peek).concat([T.defuse, T.skip, T.attack, T.favor]),
    );
    expect(s.players[0].hand).toHaveLength(9);
    valid(s);
  });
  it("взрыв не попадает в руку и не может быть отменён; защита тоже", () => {
    let s = game();
    hand(s, 0, [T.defuse, T.nope]);
    first(s, T.danger);
    s = act(s, { type: "draw" });
    expect(s.phase).toBe("danger");
    expect(s.players[0].hand.some((c) => c.type === T.danger)).toBe(false);
    expect(
      applyAction(
        s,
        commandFor(s, { type: "nope", cardId: s.players[0].hand[1].id }),
      ).error,
    ).toBeTruthy();
    s = act(s, { type: "defend" });
    expect(s.phase).toBe("insert");
    expect(s.discard.at(-1)?.type).toBe(T.defuse);
    expect(
      applyAction(
        s,
        commandFor(s, { type: "nope", cardId: s.players[0].hand[0].id }),
      ).error,
    ).toBeTruthy();
    valid(s);
  });
  for (const which of ["top", "middle", "bottom"] as const)
    it(`возврат взрыва ${which} сохраняет остальной порядок и долг`, () => {
      let s = game();
      hand(s, 0, [T.defuse]);
      first(s, T.danger);
      s.remaining = 3;
      s.attacked = true;
      s = act(s, { type: "draw" });
      const danger = s.pending?.kind === "danger" ? s.pending.card : null;
      s = act(s, { type: "defend" });
      const old = [...s.deck];
      const position =
        which === "top"
          ? 0
          : which === "bottom"
            ? old.length
            : Math.floor(old.length / 2);
      s = act(s, { type: "insert", position });
      expect(s.deck[position]).toEqual(danger);
      expect(s.deck.filter((c) => c.id !== danger?.id)).toEqual(old);
      expect(s.active).toBe(0);
      expect(s.remaining).toBe(2);
      valid(s);
    });
  it("неверная позиция ничего не меняет", () => {
    let s = game();
    first(s, T.danger);
    s = act(s, { type: "draw" });
    s = act(s, { type: "defend" });
    for (const position of [-1, NaN, 0.5, s.deck.length + 1])
      expect(
        applyAction(s, commandFor(s, { type: "insert", position })).state,
      ).toBe(s);
  });
  it("выбывание списывает атакованный долг и пропускает выбывшего", () => {
    let s = game();
    hand(s, 0, [T.nope]);
    first(s, T.danger);
    s.remaining = 4;
    s.attacked = true;
    s = act(s, { type: "draw" });
    expect(s.players[0].alive).toBe(false);
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.remaining).toBe(1);
    expect(s.attacked).toBe(false);
    expect(s.active).toBe(1);
    valid(s);
  });
  it("побеждает последний живой", () => {
    let s = game(2);
    hand(s, 0, []);
    first(s, T.danger);
    s = act(s, { type: "draw" });
    expect(s.status).toBe("finished");
    expect(s.winners).toEqual(["p1"]);
    valid(s);
  });
  it("пустая колода: совместная победа, а не бесконечный ход", () => {
    let s = game();
    s.discard.push(...s.deck.splice(0));
    s = act(s, { type: "draw" });
    expect(s.endReason).toBe("empty");
    expect(s.winners).toHaveLength(3);
    valid(s);
  });
});
describe("атаки и пропуски", () => {
  it("атака не исполняется до закрытия NOPE", () => {
    let s = game();
    s = begin(s, T.attack);
    expect(s.phase).toBe("nope");
    expect(s.active).toBe(0);
    expect(s.remaining).toBe(1);
    s = passes(s);
    expect(s.active).toBe(1);
    expect(s.remaining).toBe(2);
    valid(s);
  });
  it("обычная атака, ответная атака и атака после одного пропуска: 2 → 4 → 5", () => {
    let s = game();
    s = play(s, T.attack);
    expect(s.remaining).toBe(2);
    s = play(s, T.attack);
    expect(s.remaining).toBe(4);
    s = play(s, T.skip);
    expect(s.remaining).toBe(3);
    s = play(s, T.attack);
    expect(s.remaining).toBe(5);
    expect(s.direction).toBe(1);
    valid(s);
  });
  it("из двух ходов один пропущен: ответная атака назначает три", () => {
    let s = game();
    s = play(s, T.attack);
    s = play(s, T.skip);
    expect(s.remaining).toBe(1);
    expect(s.attacked).toBe(true);
    s = play(s, T.attack);
    expect(s.remaining).toBe(3);
  });
  it("несколько пропусков завершают только свои обязательства", () => {
    let s = game();
    s.remaining = 3;
    s.attacked = true;
    for (const remaining of [2, 1]) {
      s = play(s, T.skip);
      expect(s.remaining).toBe(remaining);
      expect(s.active).toBe(0);
    }
    s = play(s, T.skip);
    expect(s.active).toBe(1);
  });
});
describe("NOPE и отмена отмены", () => {
  it("NOPE действует вне своего хода и отменяет атаку", () => {
    let s = game();
    hand(s, 1, [T.nope]);
    s = begin(s, T.attack);
    expect(decisionPlayerId(s)).toBe("p1");
    s = act(s, { type: "nope", cardId: s.players[1].hand[0].id });
    s = passes(s);
    expect(s.active).toBe(0);
    expect(s.remaining).toBe(1);
    expect(s.discard.filter((c) => c.type === T.attack)).toHaveLength(1);
    valid(s);
  });
  for (const count of [2, 3])
    it(`${count} NOPE: чётность цепочки`, () => {
      let s = game();
      hand(s, 0, [T.attack, T.nope]);
      hand(s, 1, Array(count - 1).fill(T.nope));
      s = begin(s, T.attack);
      s = act(s, { type: "nope", cardId: s.players[1].hand[0].id });
      s = act(s, { type: "pass" });
      expect(decisionPlayerId(s)).toBe("p0");
      s = act(s, { type: "nope", cardId: s.players[0].hand[0].id });
      if (count === 3)
        s = act(s, { type: "nope", cardId: s.players[1].hand[0].id });
      s = passes(s);
      expect(s.active).toBe(count % 2 === 0 ? 1 : 0);
      expect(s.remaining).toBe(count % 2 === 0 ? 2 : 1);
      valid(s);
    });
  it("исполнитель не отменяет собственное действие; поздняя отмена запрещена", () => {
    let s = game();
    hand(s, 0, [T.attack, T.nope]);
    s = begin(s, T.attack);
    expect(
      applyAction(s, {
        actor: "p0",
        revision: s.revision,
        move: { type: "nope", cardId: s.players[0].hand[0].id },
      }).error,
    ).toBeTruthy();
    s = passes(s);
    const result = applyAction(
      s,
      commandFor(s, {
        type: "nope",
        cardId: s.players[1].hand[0]?.id ?? "none",
      }),
    );
    expect(result.state).toBe(s);
    expect(result.error).toBeTruthy();
  });
  it("вне фазы отмены NOPE не является одиночным действием", () => {
    const s = game();
    hand(s, 0, [T.nope]);
    expect(
      applyAction(
        s,
        commandFor(s, { type: "play", cardId: s.players[0].hand[0].id }),
      ).error,
    ).toBeTruthy();
  });
  it("отменённый пропуск не списывает долг, отменённый просмотр не раскрывает будущее", () => {
    for (const type of [T.skip, T.peek]) {
      let s = game();
      s.remaining = 2;
      s.attacked = true;
      hand(s, 1, [T.nope]);
      s = begin(s, type);
      s = act(s, { type: "nope", cardId: s.players[1].hand[0].id });
      s = passes(s);
      expect(s.remaining).toBe(2);
      expect(s.active).toBe(0);
      expect(s.known).toEqual({});
      expect(s.pending).toBeNull();
    }
  });
});
describe("комбинации и одолжение", () => {
  it("каждая из пяти семейных карт не имеет одиночного действия", () => {
    for (const type of [T.homework, T.piggy, T.chinese, T.dance, T.draw]) {
      const s = game();
      hand(s, 0, [type]);
      expect(
        applyAction(
          s,
          commandFor(s, { type: "play", cardId: s.players[0].hand[0].id }),
        ).error,
      ).toBeTruthy();
    }
  });
  it("пара забирает ровно одну случайную карту, не выполняя обычное действие", () => {
    let s = game();
    s = combo(s, T.attack, 2);
    const before = [...s.players[1].hand];
    s = act(s, { type: "target", targetId: "p1" });
    s = passes(s);
    expect(s.players[0].hand).toHaveLength(1);
    expect(before).toContainEqual(s.players[0].hand[0]);
    expect(s.players[1].hand).toHaveLength(before.length - 1);
    expect(s.active).toBe(0);
    expect(s.remaining).toBe(1);
    valid(s);
  });
  it("тройка запрашивает названный тип, в том числе DEFUSE", () => {
    let s = game();
    s = combo(s, T.chinese, 3);
    s = act(s, { type: "target", targetId: "p1", cardType: T.defuse });
    s = passes(s);
    expect(s.players[0].hand[0].type).toBe(T.defuse);
    expect(s.players[1].hand.some((c) => c.type === T.defuse)).toBe(false);
    valid(s);
  });
  it("если названной карты нет, тройка не передаёт ничего", () => {
    let s = game();
    hand(s, 1, [T.skip]);
    s = combo(s, T.homework, 3);
    s = act(s, { type: "target", targetId: "p1", cardType: T.defuse });
    s = passes(s);
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.log[0]).toContain("Такой карты нет");
    valid(s);
  });
  it("комбинации DEFUSE и NOPE допустимы и не выполняют свои эффекты", () => {
    for (const type of [T.defuse, T.nope]) {
      let s = game();
      s = combo(s, type, 2);
      s = act(s, { type: "target", targetId: "p1" });
      s = passes(s);
      expect(s.remaining).toBe(1);
      expect(s.players[0].hand).toHaveLength(1);
      valid(s);
    }
  });
  for (const count of [2, 3] as const)
    it(`комбинация из ${count} карт отменяется`, () => {
      let s = game();
      hand(s, 1, [T.nope]);
      s = combo(s, T.draw, count);
      s = act(s, {
        type: "target",
        targetId: "p1",
        ...(count === 3 ? { cardType: T.nope } : {}),
      });
      s = act(s, { type: "nope", cardId: s.players[1].hand[0].id });
      s = passes(s);
      expect(s.players[0].hand).toHaveLength(0);
      expect(s.discard.filter((c) => c.type === T.draw)).toHaveLength(count);
      valid(s);
    });
  it("нельзя повторить один экземпляр, смешать типы, сыграть четыре или пять", () => {
    const s = game();
    hand(s, 0, [T.homework, T.homework, T.draw, T.draw, T.draw]);
    const h = s.players[0].hand;
    for (const ids of [
      [h[0].id, h[0].id],
      [h[0].id, h[2].id],
      h.slice(0, 4).map((c) => c.id),
      h.map((c) => c.id),
    ]) {
      expect(
        applyAction(s, commandFor(s, { type: "combo", cardIds: ids })).error,
      ).toBeTruthy();
    }
  });
  it("пустая рука соперника — без передачи; выбывший и собственный игрок запрещены", () => {
    let s = game();
    hand(s, 1, []);
    s = combo(s, T.piggy, 2);
    expect(
      applyAction(s, commandFor(s, { type: "target", targetId: "p0" })).error,
    ).toBeTruthy();
    s.players[2].alive = false;
    s.discard.push(...s.players[2].hand.splice(0));
    expect(
      applyAction(s, commandFor(s, { type: "target", targetId: "p2" })).error,
    ).toBeTruthy();
    s = act(s, { type: "target", targetId: "p1" });
    s = passes(s);
    expect(s.players[0].hand).toHaveLength(0);
  });
  it("FAVOR: карту выбирает отдающий, а не получатель или случай", () => {
    let s = game();
    hand(s, 1, [T.defuse, T.skip, T.dance]);
    s = begin(s, T.favor);
    s = act(s, { type: "target", targetId: "p1" });
    s = passes(s);
    expect(s.phase).toBe("give");
    expect(decisionPlayerId(s)).toBe("p1");
    const selected = s.players[1].hand[1];
    const before = s.players[0].hand.length;
    expect(
      applyAction(s, {
        actor: "p0",
        revision: s.revision,
        move: { type: "give", cardId: selected.id },
      }).error,
    ).toBeTruthy();
    s = act(s, { type: "give", cardId: selected.id });
    expect(s.players[0].hand).toHaveLength(before + 1);
    expect(s.players[0].hand.at(-1)).toEqual(selected);
    expect(s.players[1].hand.some((c) => c.type === T.defuse)).toBe(true);
    expect(s.log[0]).not.toContain("градусником");
    valid(s);
  });
  it("FAVOR к пустой руке завершается без диалога передачи", () => {
    let s = game();
    hand(s, 1, []);
    s = begin(s, T.favor);
    s = act(s, { type: "target", targetId: "p1" });
    s = passes(s);
    expect(s.phase).toBe("turn");
    expect(s.pending).toBeNull();
    valid(s);
  });
});
describe("просмотр, перемешивание, секретность, сохранение", () => {
  it("просмотр не меняет порядок и доступен только владельцу", () => {
    let s = game();
    hand(s, 0, [T.peek]);
    const order = [...s.deck];
    s = play(s, T.peek);
    expect(s.deck).toEqual(order);
    expect(viewFor(s, "p0").knownTop).toEqual(
      order.slice(0, 3).map((c) => c.type),
    );
    expect(viewFor(s, "p1").pending).toBeNull();
    expect(viewFor(s, "p1").knownTop).toEqual([]);
    s = act(s, { type: "ack" });
    valid(s);
  });
  it("в почти пустой колоде показывает только имеющиеся карты", () => {
    let s = game();
    hand(s, 0, [T.peek]);
    s.discard.push(...s.deck.splice(1));
    s = play(s, T.peek);
    expect(s.pending?.kind === "peek" && s.pending.cards).toHaveLength(1);
    valid(s);
  });
  it("shuffle сохраняет руки, исключённые карты и состав; знания сбрасываются", () => {
    let s = game();
    hand(s, 0, [T.peek, T.shuffle]);
    s = play(s, T.peek);
    s = act(s, { type: "ack" });
    const id = s.deck.map((c) => c.id).sort();
    const other = structuredClone(s.players[1].hand);
    const excluded = [...s.excluded];
    s = play(s, T.shuffle);
    expect(s.deck.map((c) => c.id).sort()).toEqual(id);
    expect(s.players[1].hand).toEqual(other);
    expect(s.excluded).toEqual(excluded);
    expect(s.known).toEqual({});
    valid(s);
  });
  it("представление не содержит чужих рук, колоды, исключённых типов или чужой фазы выбора", () => {
    let s = game();
    s = begin(s, T.favor);
    s = act(s, { type: "target", targetId: "p1" });
    s = passes(s);
    const v = viewFor(s, "p0");
    expect(v).not.toHaveProperty("deck");
    expect(v).not.toHaveProperty("excluded");
    expect(v.players[1]).not.toHaveProperty("hand");
    expect(v.pending).toBeNull();
    expect(viewFor(s, "p1").pending?.kind).toBe("give");
    v.hand.pop();
    expect(s.players[0].hand.length).not.toBe(v.hand.length);
  });
  it("бот не получает неизвестный порядок и чужие карты", () => {
    const a = game();
    a.active = 1;
    const b = structuredClone(a);
    b.deck.reverse();
    const temp = b.players[0].hand;
    b.players[0].hand = b.players[2].hand;
    b.players[2].hand = temp;
    expect(chooseMove(viewFor(a, "p1"), () => 0.4)).toEqual(
      chooseMove(viewFor(b, "p1"), () => 0.4),
    );
  });
  it("сохраняются все фазы NOPE, отдачи, просмотра и защиты", () => {
    const storage = memory();
    let s = game();
    hand(s, 0, [T.favor, T.peek, T.defuse]);
    const check = () => {
      valid(s);
      saveGame(storage, s);
      expect(loadGame(storage).game).toEqual(s);
    };
    s = begin(s, T.favor);
    check();
    s = act(s, { type: "target", targetId: "p1" });
    check();
    s = passes(s);
    check();
    s = act(s, { type: "give", cardId: s.players[1].hand[0].id });
    s = play(s, T.peek);
    check();
    s = act(s, { type: "ack" });
    if (!s.players[0].hand.some((c) => c.type === T.defuse))
      hand(s, 0, [T.defuse]);
    first(s, T.danger);
    s = act(s, { type: "draw" });
    check();
    s = act(s, { type: "defend" });
    check();
  });
  it("старое сохранение не стирается и не смешивается с новой конфигурацией", () => {
    const storage = memory();
    storage.setItem(LEGACY_GAME_KEY, "old-game");
    expect(loadGame(storage).error).toContain("39");
    saveGame(storage, game());
    expect(storage.getItem(LEGACY_GAME_KEY)).toBe("old-game");
    expect(loadGame(storage).game?.version).toBe(2);
  });
  it("повреждённое сохранение, дублирование ID и несовместимая фаза отклоняются", () => {
    const storage = memory();
    storage.setItem(GAME_KEY, "{}");
    expect(loadGame(storage).error).toBeTruthy();
    const s = game();
    s.players[0].hand[0] = s.players[1].hand[0];
    expect(isGameState(s)).toBe(false);
    const b = game();
    b.phase = "nope";
    expect(isGameState(b)).toBe(false);
  });
  it("чужой ход, взятие во время выбора и повторная команда не меняют состояние", () => {
    let s = game();
    const snapshot = structuredClone(s);
    expect(
      applyAction(s, {
        actor: "p1",
        revision: s.revision,
        move: { type: "draw" },
      }).state,
    ).toBe(s);
    expect(s).toEqual(snapshot);
    s = begin(s, T.attack);
    expect(applyAction(s, commandFor(s, { type: "draw" })).state).toBe(s);
    const command = commandFor(s, { type: "pass" });
    const next = applyAction(s, command).state;
    expect(applyAction(next, command).state).toBe(next);
  });
  for (const difficulty of ["easy", "medium", "hard"] as const)
    it(`${difficulty}: 30 полных партий, все 56 экземпляров сохраняются на каждом шаге`, () => {
      for (let n = 0; n < 30; n++) {
        const random = seed(100 + n);
        let s = newGame(
          { mode: "bots", players: 2 + (n % 4), difficulty },
          random,
        );
        let steps = 0;
        while (s.status === "playing" && steps < 3000) {
          const r = applyAction(
            s,
            commandFor(s, chooseMove(viewFor(s, decisionPlayerId(s)), random)),
            random,
          );
          expect(r.error).toBeUndefined();
          s = r.state;
          valid(s);
          expect(cardCounts(s)[T.nope]).toBe(5);
          steps++;
        }
        expect(s.status).toBe("finished");
        expect(s.winners.length).toBeGreaterThan(0);
      }
    });
});
