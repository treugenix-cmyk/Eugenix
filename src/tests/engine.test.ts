import { describe, it, expect } from "vitest";
import { CARDS, CARD_TYPES, type Card, type CardType } from "../cards";
import { createDeck, deal } from "../deck";
import {
  applyAction,
  newGame,
  commandFor,
  viewFor,
  cardCounts,
  type GameState,
  type Move,
} from "../game-engine";
import { chooseMove } from "../bots";
import { saveGame, loadGame, isGameState, GAME_KEY } from "../storage";
const seed = (n: number) => () => {
  n = (n * 1664525 + 1013904223) >>> 0;
  return n / 4294967296;
};
let serial = 0;
const card = (type: CardType): Card => ({ id: `test-${serial++}`, type });
const game = (players = 3) =>
  newGame({ mode: "bots", players, difficulty: "hard" }, seed(7));
function give(s: GameState, type: CardType, player = s.active) {
  const c = card(type);
  s.players[player].hand.push(c);
  return c.id;
}
function act(s: GameState, move: Move) {
  const r = applyAction(s, commandFor(s, move), seed(42));
  expect(r.error).toBeUndefined();
  return r.state;
}
function play(s: GameState, type: CardType) {
  return act(s, { type: "play", cardId: give(s, type) });
}
function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}
describe("колода и раздача", () => {
  it("ровно 39 карт и десять заданных типов", () => {
    const all = createDeck();
    expect(all).toHaveLength(39);
    expect(new Set(all.map((c) => c.id)).size).toBe(39);
    for (const type of CARD_TYPES)
      expect(all.filter((c) => c.type === type)).toHaveLength(
        CARDS[type].count,
      );
  });
  for (const n of [2, 3, 4, 5])
    it(`безопасная раздача для ${n} игроков`, () => {
      const { hands, deck } = deal(n, seed(n));
      expect(hands).toHaveLength(n);
      for (const h of hands) {
        expect(h).toHaveLength(5);
        expect(h.filter((c) => c.type === "defuse")).toHaveLength(1);
        expect(h.some((c) => c.type === "danger")).toBe(false);
      }
      expect(deck.filter((c) => c.type === "danger")).toHaveLength(n - 1);
      expect(deck.filter((c) => c.type === "defuse")).toHaveLength(6 - n);
    });
  it("отклоняет недопустимое число игроков", () => {
    for (const n of [1, 6, 2.5]) expect(() => deal(n)).toThrow();
  });
});
describe("ходы и опасность", () => {
  it("обычная карта добавляется в руку, ход переходит", () => {
    let s = game();
    const c = card("skip");
    s.deck = [c];
    const before = s.players[0].hand.length;
    s = act(s, { type: "draw" });
    expect(s.players[0].hand).toHaveLength(before + 1);
    expect(s.active).toBe(1);
  });
  it("опасность ждёт защиту и блокирует взятие", () => {
    let s = game();
    s.deck.unshift(card("danger"));
    s = act(s, { type: "draw" });
    expect(s.pending?.kind).toBe("danger");
    expect(applyAction(s, commandFor(s, { type: "draw" })).error).toBeTruthy();
  });
  it("защита уходит в сброс, опасность вставляется в выбранную позицию", () => {
    let s = game();
    const danger = card("danger");
    s.deck = [danger, card("peek"), card("skip")];
    s = act(s, { type: "draw" });
    s = act(s, { type: "defend" });
    expect(s.discard.at(-1)?.type).toBe("defuse");
    expect(s.pending?.kind).toBe("insert");
    expect(
      applyAction(s, commandFor(s, { type: "insert", position: -1 })).error,
    ).toBeTruthy();
    s = act(s, { type: "insert", position: 1 });
    expect(s.deck[1].id).toBe(danger.id);
    expect(s.active).toBe(1);
  });
  it("без защиты игрок выбывает и теряет накопленные ходы", () => {
    let s = game();
    s.players[0].hand = s.players[0].hand.filter((c) => c.type !== "defuse");
    s.deck = [card("danger")];
    s.remaining = 4;
    s.attacked = true;
    s = act(s, { type: "draw" });
    expect(s.players[0].alive).toBe(false);
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.remaining).toBe(1);
    expect(s.attacked).toBe(false);
    expect(s.deck).toHaveLength(0);
    expect(s.active).toBe(1);
  });
  it("последний живой побеждает", () => {
    let s = game(2);
    s.players[0].hand = [];
    s.deck = [card("danger")];
    s = act(s, { type: "draw" });
    expect(s.status).toBe("finished");
    expect(s.winners).toEqual(["p1"]);
  });
  it("пустая колода завершает игру совместной победой", () => {
    let s = game();
    s.deck = [];
    s = act(s, { type: "draw" });
    expect(s.status).toBe("finished");
    expect(s.endReason).toBe("empty");
    expect(s.winners).toHaveLength(3);
  });
  it("чужой ход, защита в обычном ходе, повторное нажатие отклоняются", () => {
    const s = game();
    expect(
      applyAction(s, { actor: "p1", revision: 0, move: { type: "draw" } })
        .error,
    ).toBeTruthy();
    const defense = s.players[0].hand.find((c) => c.type === "defuse")!;
    expect(
      applyAction(s, commandFor(s, { type: "play", cardId: defense.id })).error,
    ).toBeTruthy();
    const cmd = commandFor(s, { type: "draw" });
    const next = applyAction(s, cmd).state;
    expect(applyAction(next, cmd).state).toBe(next);
    expect(applyAction(next, cmd).error).toBeTruthy();
  });
});
describe("карты действий", () => {
  it("последовательные пропуски расходуют только по одному обязательству", () => {
    let s = game();
    s.remaining = 3;
    s.attacked = true;
    s = play(s, "skip");
    expect(s.active).toBe(0);
    expect(s.remaining).toBe(2);
    s = play(s, "skip");
    expect(s.remaining).toBe(1);
    s = play(s, "skip");
    expect(s.active).toBe(1);
    expect(s.remaining).toBe(1);
  });
  it("разворот меняет направление, сохраняя долг", () => {
    let s = game();
    s.remaining = 4;
    s.attacked = true;
    s = play(s, "reverse");
    expect(s.direction).toBe(-1);
    expect(s.remaining).toBe(4);
    s = play(s, "skip");
    expect(s.remaining).toBe(3);
  });
  it("вдвоём разворот пропускает соперника и не стирает атаки", () => {
    let s = game(2);
    s = play(s, "reverse");
    expect(s.active).toBe(0);
    s.remaining = 3;
    s.attacked = true;
    s = play(s, "reverse");
    expect(s.active).toBe(0);
    expect(s.remaining).toBe(2);
  });
  it("обычная, ответная и частично выполненная атака", () => {
    let s = game();
    s = play(s, "attack");
    expect(s.active).toBe(1);
    expect(s.remaining).toBe(2);
    s = play(s, "attack");
    expect(s.remaining).toBe(4);
    expect(s.active).toBe(2);
    s = play(s, "skip");
    expect(s.remaining).toBe(3);
    s = play(s, "attack");
    expect(s.remaining).toBe(5);
    expect(s.active).toBe(0);
  });
  it("просмотр сохраняет порядок и доступен только владельцу", () => {
    let s = game();
    const before = [...s.deck];
    s = play(s, "peek");
    expect(s.deck).toEqual(before);
    expect(viewFor(s, "p0").knownTop).toEqual(
      before.slice(0, 3).map((c) => c.type),
    );
    expect(viewFor(s, "p1").knownTop).toEqual([]);
    expect(viewFor(s, "p1").pending).toBeNull();
    s = act(s, { type: "ack" });
    expect(s.pending).toBeNull();
  });
  it("перемешивание не меняет руки и состав колоды, забывает знания", () => {
    let s = game();
    s.known = { p0: ["danger"], p1: ["skip"] };
    const ids = s.deck.map((c) => c.id).sort();
    const others = structuredClone(s.players[1].hand);
    s = play(s, "shuffle");
    expect(s.deck.map((c) => c.id).sort()).toEqual(ids);
    expect(s.players[1].hand).toEqual(others);
    expect(s.known).toEqual({});
  });
  it("запрос передаёт ровно одну карту и не раскрывает остальные", () => {
    let s = game();
    s = play(s, "request");
    const before = s.players[0].hand.length;
    const other = s.players[1].hand.length;
    s = act(s, { type: "request", targetId: "p1", cardType: "defuse" });
    expect(s.players[0].hand).toHaveLength(before + 1);
    expect(s.players[1].hand).toHaveLength(other - 1);
    expect(s.log[0]).toContain("Карта передана");
  });
  it("несуществующая карта не передаётся, выбывший игрок и опасный тип недопустимы", () => {
    let s = game();
    s.players[1].hand = [];
    s = play(s, "request");
    expect(
      applyAction(
        s,
        commandFor(s, { type: "request", targetId: "p1", cardType: "danger" }),
      ).error,
    ).toBeTruthy();
    s.players[2].alive = false;
    expect(
      applyAction(
        s,
        commandFor(s, { type: "request", targetId: "p2", cardType: "skip" }),
      ).error,
    ).toBeTruthy();
    s = act(s, { type: "request", targetId: "p1", cardType: "skip" });
    expect(s.log[0]).toContain("Такой карты нет");
  });
  for (const type of ["top", "bottom"] as const)
    it(`${type}: размещение атомарно и не завершает ход`, () => {
      let s = game();
      const id = give(s, type);
      s = act(s, { type: "play", cardId: id });
      expect(
        applyAction(s, commandFor(s, { type: "place", cardId: id })).error,
      ).toBeTruthy();
      const selected = s.players[0].hand[0];
      const cmd = commandFor(s, { type: "place", cardId: selected.id });
      s = applyAction(s, cmd).state;
      expect((type === "top" ? s.deck[0] : s.deck.at(-1))?.id).toBe(
        selected.id,
      );
      expect(s.active).toBe(0);
      expect(applyAction(s, cmd).error).toBeTruthy();
    });
  it("нельзя запускать размещение без другой карты", () => {
    const s = game();
    const c = card("top");
    s.players[0].hand = [c];
    expect(
      applyAction(s, commandFor(s, { type: "play", cardId: c.id })).error,
    ).toBeTruthy();
  });
});
describe("краевые случаи и инварианты", () => {
  it("ответная атака после последнего пропуска передаёт три обязательства", () => {
    let s = game();
    s = play(s, "attack");
    s = play(s, "skip");
    expect(s.remaining).toBe(1);
    expect(s.attacked).toBe(true);
    s = play(s, "attack");
    expect(s.remaining).toBe(3);
  });
  it("разворот обходит выбывшего при передаче атаки", () => {
    let s = game(4);
    s.players[3].alive = false;
    s.players[3].hand = [];
    s = play(s, "reverse");
    s = play(s, "attack");
    expect(s.active).toBe(2);
    expect(s.remaining).toBe(2);
  });
  it("вставка опасности наверх и вниз, включая пустую колоду", () => {
    for (const place of [0, 2]) {
      let s = game();
      const danger = card("danger");
      s.deck = [danger, card("peek"), card("skip")];
      s = act(s, { type: "draw" });
      s = act(s, { type: "defend" });
      s = act(s, { type: "insert", position: place });
      expect(s.deck[place]).toEqual(danger);
    }
    let s = game();
    s.deck = [card("danger")];
    s = act(s, { type: "draw" });
    s = act(s, { type: "defend" });
    s = act(s, { type: "insert", position: 0 });
    expect(s.deck).toHaveLength(1);
  });
  it("просмотр менее трёх карт и сдвиг собственной памяти после взятия", () => {
    let s = game();
    s.deck = [card("skip"), card("reverse")];
    s = play(s, "peek");
    expect(s.pending).toEqual({ kind: "peek", cards: ["skip", "reverse"] });
    s = act(s, { type: "ack" });
    s = act(s, { type: "draw" });
    expect(s.known.p0).toEqual(["reverse"]);
  });
  it("недопустимые действия не меняют исходное состояние", () => {
    const s = game();
    const snapshot = structuredClone(s);
    for (const move of [
      { type: "insert", position: 0 },
      { type: "defend" },
      { type: "ack" },
      { type: "place", cardId: s.players[0].hand[0].id },
    ] as Move[]) {
      expect(applyAction(s, commandFor(s, move)).error).toBeTruthy();
      expect(s).toEqual(snapshot);
    }
  });
});
describe("личные сведения о колоде", () => {
  it("возврат наверх известен только вернувшему; бот с долгом выбирает низ", () => {
    let s = game();
    s.remaining = 3;
    s.attacked = true;
    s.deck.unshift(card("danger"));
    s = act(s, { type: "draw" });
    s = act(s, { type: "defend" });
    expect(chooseMove(viewFor(s, "p0"))).toEqual({
      type: "insert",
      position: s.deck.length,
    });
    s = act(s, { type: "insert", position: 0 });
    expect(viewFor(s, "p0").knownTop).toEqual(["danger"]);
    expect(viewFor(s, "p1").knownTop).toEqual([]);
  });
});
describe("приватность, боты, сохранение", () => {
  it("представление не содержит чужие руки или колоду", () => {
    const s = game();
    const v = viewFor(s, "p0");
    expect(v).not.toHaveProperty("deck");
    expect(v.players[1]).not.toHaveProperty("hand");
    v.hand.pop();
    expect(s.players[0].hand).toHaveLength(5);
  });
  it("бот не реагирует на неизвестный порядок и чужие карты", () => {
    const a = game();
    a.active = 1;
    const b = structuredClone(a);
    b.deck.reverse();
    b.players[2].hand = [card("attack")];
    expect(chooseMove(viewFor(a, "p1"), () => 0.4)).toEqual(
      chooseMove(viewFor(b, "p1"), () => 0.4),
    );
  });
  it("сохранение восстанавливает незавершённый выбор, повреждение отклоняется", () => {
    const storage = memory();
    let s = game();
    const i = s.deck.findIndex((c) => c.type === "peek");
    const old = s.players[0].hand[1];
    s.players[0].hand[1] = s.deck[i];
    s.deck[i] = old;
    s = act(s, { type: "play", cardId: s.players[0].hand[1].id });
    expect(s.pending?.kind).toBe("peek");
    expect(isGameState(s)).toBe(true);
    saveGame(storage, s);
    expect(loadGame(storage).game).toEqual(s);
    storage.setItem(GAME_KEY, '{"version":1}');
    expect(loadGame(storage).error).toBeTruthy();
  });
  it("сохранение при опасности, спасении и тайной вставке", () => {
    const storage = memory();
    let s = game();
    const i = s.deck.findIndex((c) => c.type === "danger");
    [s.deck[0], s.deck[i]] = [s.deck[i], s.deck[0]];
    s = act(s, { type: "draw" });
    for (let step = 0; step < 2; step++) {
      saveGame(storage, s);
      expect(loadGame(storage).game).toEqual(s);
      if (step === 0) s = act(s, { type: "defend" });
    }
  });
  for (const difficulty of ["easy", "medium", "hard"] as const)
    it(`${difficulty}: 30 партий ботов заканчиваются, состав карт не теряется`, () => {
      for (let n = 0; n < 30; n++) {
        const random = seed(n + 100);
        let s = newGame(
          { mode: "bots", players: 2 + (n % 4), difficulty },
          random,
        );
        const initial = cardCounts(s);
        let actions = 0;
        while (s.status === "playing" && actions < 1500) {
          const view = viewFor(s, s.players[s.active].id);
          const r = applyAction(
            s,
            commandFor(s, chooseMove(view, random)),
            random,
          );
          expect(r.error).toBeUndefined();
          s = r.state;
          expect(cardCounts(s)).toEqual(initial);
          expect(isGameState(s)).toBe(true);
          actions++;
        }
        expect(s.status).toBe("finished");
        expect(s.winners.length).toBeGreaterThan(0);
      }
    });
});
