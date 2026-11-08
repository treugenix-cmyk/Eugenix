import { CARDS, CARD_TYPES, T, type Card, type CardType } from "../cards";
import { deal, shuffle, type Random } from "../deck";
import { endObligation, nextAlive, passAttack } from "../turn-manager";
import type {
  ActionKind,
  ActionPlan,
  Command,
  GameConfig,
  GameState,
  Pending,
  PlayerView,
} from "./types";
export * from "./types";
export const SINGLE_EFFECTS: Partial<Record<CardType, ActionKind>> = {
  [T.skip]: "skip",
  [T.attack]: "attack",
  [T.peek]: "peek",
  [T.shuffle]: "shuffle",
  [T.favor]: "favor",
};
export function newGame(
  config: GameConfig,
  random: Random = Math.random,
): GameState {
  if (
    !["bots", "local"].includes(config.mode) ||
    !["easy", "medium", "hard"].includes(config.difficulty)
  )
    throw new Error("Некорректные настройки игры.");
  const { hands, deck, excluded } = deal(config.players, random);
  return {
    version: 2,
    id: globalThis.crypto?.randomUUID?.() ?? `game-${Date.now()}-${random()}`,
    config: { ...config },
    players: hands.map((hand, i) => ({
      id: `p${i}`,
      name:
        config.mode === "bots"
          ? i === 0
            ? "Вы"
            : `Бот ${i}`
          : `Игрок ${i + 1}`,
      bot: config.mode === "bots" && i > 0,
      alive: true,
      hand,
    })),
    deck,
    excluded,
    discard: [],
    active: 0,
    direction: 1,
    remaining: 1,
    attacked: false,
    turn: 1,
    revision: 0,
    phase: "turn",
    pending: null,
    known: {},
    log: [
      "Карты розданы: каждому одна Мама и семь других карт. Ходим по часовой стрелке.",
    ],
    status: "playing",
    winners: [],
    endReason: null,
    effect: "deal",
  };
}
function log(s: GameState, text: string) {
  s.log = [text, ...s.log].slice(0, 60);
}
function setPending(s: GameState, pending: Pending | null) {
  s.pending = pending;
  s.phase = pending?.kind ?? "turn";
}
function forget(s: GameState) {
  s.known = {};
}
function finish(s: GameState, reason: "last" | "empty") {
  s.active = s.players.findIndex((p) => p.alive);
  s.status = "finished";
  s.endReason = reason;
  setPending(s, null);
  s.phase = "finished";
  s.winners = s.players.filter((p) => p.alive).map((p) => p.id);
  s.effect = "win";
  log(
    s,
    reason === "empty"
      ? "Колода пуста: оставшиеся игроки делят победу."
      : `${s.players[s.active].name} — победитель!`,
  );
}
export function decisionPlayerId(s: GameState): string {
  if (s.pending?.kind === "nope") return s.pending.responder;
  if (s.pending?.kind === "give") return s.pending.fromId;
  return s.players[s.active].id;
}
export function playable(v: PlayerView, cardId: string) {
  if (v.status !== "playing" || v.phase !== "turn" || v.activeId !== v.id)
    return false;
  const card = v.hand.find((c) => c.id === cardId);
  return !!card && Object.hasOwn(SINGLE_EFFECTS, card.type);
}
export function comboable(v: PlayerView, ids: string[]) {
  if (
    v.status !== "playing" ||
    v.phase !== "turn" ||
    v.activeId !== v.id ||
    ![2, 3].includes(ids.length) ||
    new Set(ids).size !== ids.length
  )
    return false;
  const cards = ids.map((id) => v.hand.find((c) => c.id === id));
  return cards.every(
    (c) => c && c.type !== T.danger && c.type === cards[0]?.type,
  );
}
export function viewFor(s: GameState, id: string): PlayerView {
  const p = s.players.find((p) => p.id === id);
  if (!p) throw new Error("Игрок не найден.");
  return structuredClone({
    id,
    revision: s.revision,
    turn: s.turn,
    config: s.config,
    players: s.players.map(({ hand, ...rest }) => ({
      ...rest,
      cardCount: hand.length,
    })),
    activeId: s.players[s.active].id,
    decisionId: decisionPlayerId(s),
    direction: s.direction,
    remaining: s.remaining,
    attacked: s.attacked,
    phase: s.phase,
    hand: p.hand,
    deckCount: s.deck.length,
    discard: s.discard,
    excludedCount: s.excluded.length,
    pending: decisionPlayerId(s) === id ? s.pending : null,
    knownTop: s.known[id] ?? [],
    dangerEstimate: Math.max(
      0,
      s.players.filter((p) => p.alive).length -
        1 -
        (s.pending?.kind === "danger" || s.pending?.kind === "insert" ? 1 : 0),
    ),
    log: s.log,
    status: s.status,
    winners: s.winners,
    endReason: s.endReason,
    effect: s.effect,
  });
}
function removeCard(hand: Card[], id: string) {
  const i = hand.findIndex((c) => c.id === id);
  return i >= 0 ? hand.splice(i, 1)[0] : null;
}
function beginNope(s: GameState, action: ActionPlan) {
  const i = s.players.findIndex((p) => p.id === action.actorId);
  setPending(s, {
    kind: "nope",
    action,
    cancelled: false,
    responder: s.players[nextAlive(s, i)].id,
    lastActor: action.actorId,
    passed: [],
  });
  log(
    s,
    "Окно отмены открыто. Каждый соперник может ответить NOPE или пропустить.",
  );
}
function resolve(s: GameState, action: ActionPlan, random: Random) {
  setPending(s, null);
  const actor = s.players.find((p) => p.id === action.actorId)!;
  const target = s.players.find((p) => p.id === action.targetId);
  switch (action.effect) {
    case "skip":
      endObligation(s);
      break;
    case "attack":
      passAttack(s);
      log(
        s,
        `${s.players[s.active].name}: обязательных ходов — ${s.remaining}.`,
      );
      break;
    case "peek": {
      const cards = s.deck.slice(0, 3).map((c) => c.type);
      s.known[actor.id] = cards;
      setPending(s, { kind: "peek", cards });
      break;
    }
    case "shuffle":
      s.deck = shuffle(s.deck, random);
      forget(s);
      s.effect = "shuffle";
      break;
    case "favor":
      if (target?.alive && target.hand.length)
        setPending(s, { kind: "give", fromId: target.id, toId: actor.id });
      else log(s, `${target?.name ?? "Соперник"}: нет карт для передачи.`);
      break;
    case "pair":
      if (target?.alive && target.hand.length) {
        const index = Math.floor(random() * target.hand.length);
        actor.hand.push(target.hand.splice(index, 1)[0]);
        s.effect = "steal";
        log(s, `${actor.name} случайно получает одну карту от ${target.name}.`);
      } else log(s, "У выбранного соперника нет карт.");
      break;
    case "triple": {
      const index = target?.alive
        ? target.hand.findIndex((c) => c.type === action.requestedType)
        : -1;
      if (index >= 0 && target) {
        actor.hand.push(target.hand.splice(index, 1)[0]);
        s.effect = "steal";
      }
      log(
        s,
        `${actor.name} просит у ${target?.name}: «${CARDS[action.requestedType!].name}». ${index >= 0 ? "Карта передана." : "Такой карты нет."}`,
      );
      break;
    }
  }
}
export interface Result {
  state: GameState;
  error?: string;
}
export function applyAction(
  original: GameState,
  command: Command,
  random: Random = Math.random,
): Result {
  const fail = (error: string): Result => ({ state: original, error });
  if (original.status !== "playing") return fail("Партия уже завершена.");
  if (command.revision !== original.revision)
    return fail("Действие уже обработано или устарело.");
  if (command.actor !== decisionPlayerId(original))
    return fail("Сейчас решение принимает другой игрок.");
  const s = structuredClone(original);
  const p = s.players[s.active];
  const move = command.move;
  const pending = s.pending;
  if (pending) {
    if (
      pending.kind === "nope" &&
      (move.type === "nope" || move.type === "pass")
    ) {
      if (move.type === "nope") {
        const responder = s.players.find((p) => p.id === command.actor)!;
        const card = responder.hand.find(
          (c) => c.id === move.cardId && c.type === T.nope,
        );
        if (!card || pending.lastActor === responder.id)
          return fail("Нет допустимой карты NOPE.");
        s.discard.push(removeCard(responder.hand, card.id)!);
        pending.cancelled = !pending.cancelled;
        pending.lastActor = responder.id;
        pending.passed = [];
        s.effect = "cancel";
        log(
          s,
          `${responder.name}: NOPE! Действие ${pending.cancelled ? "отменяется" : "снова активно"}.`,
        );
      } else pending.passed.push(command.actor);
      const i = s.players.findIndex((p) => p.id === command.actor);
      let next: string | null = null;
      for (let step = 1; step <= s.players.length; step++) {
        const candidate = s.players[(i + step) % s.players.length];
        if (
          candidate.alive &&
          candidate.id !== pending.lastActor &&
          !pending.passed.includes(candidate.id)
        ) {
          next = candidate.id;
          break;
        }
      }
      if (next) pending.responder = next;
      else if (pending.cancelled) {
        setPending(s, null);
        s.effect = "cancel";
        log(
          s,
          "Действие отменено окончательно. Разыгранные карты остаются в сбросе, ход продолжается.",
        );
      } else resolve(s, pending.action, random);
    } else if (pending.kind === "target" && move.type === "target") {
      const target = s.players.find((p) => p.id === move.targetId);
      if (!target?.alive || target.id === p.id)
        return fail("Выберите другого живого игрока.");
      if (
        pending.action.effect === "triple" &&
        (!move.cardType || !CARD_TYPES.includes(move.cardType))
      )
        return fail("Назовите тип запрашиваемой карты.");
      log(
        s,
        `${p.name} выбирает ${target.name}${pending.action.effect === "triple" ? ` и просит «${CARDS[move.cardType!].name}»` : ""}.`,
      );
      beginNope(s, {
        ...pending.action,
        targetId: target.id,
        ...(pending.action.effect === "triple"
          ? { requestedType: move.cardType }
          : {}),
      });
    } else if (pending.kind === "give" && move.type === "give") {
      const giver = s.players.find((p) => p.id === pending.fromId)!;
      const receiver = s.players.find((p) => p.id === pending.toId)!;
      const card = removeCard(giver.hand, move.cardId);
      if (!card || card.type === T.danger)
        return fail("Выберите карту из своей руки.");
      receiver.hand.push(card);
      setPending(s, null);
      s.effect = "steal";
      log(
        s,
        `${giver.name} выбирает и передаёт одну карту игроку ${receiver.name}.`,
      );
    } else if (pending.kind === "danger" && move.type === "defend") {
      const defense = p.hand.find((c) => c.type === T.defuse);
      if (!defense) return fail("Нет защитной карты.");
      s.discard.push(removeCard(p.hand, defense.id)!);
      setPending(s, { kind: "insert", card: pending.card });
      s.effect = "rescue";
      log(s, `${p.name}: Мама с салатом обезвреживает Папу!`);
    } else if (pending.kind === "insert" && move.type === "insert") {
      if (
        !Number.isInteger(move.position) ||
        move.position < 0 ||
        move.position > s.deck.length
      )
        return fail("Выберите существующую позицию колоды.");
      s.deck.splice(move.position, 0, pending.card);
      setPending(s, null);
      forget(s);
      if (move.position === 0) s.known[p.id] = [T.danger];
      endObligation(s);
      s.effect = "draw";
      log(
        s,
        `${p.name} тайно возвращает Папу в колоду и завершает одно обязательство.`,
      );
    } else if (pending.kind === "peek" && move.type === "ack") {
      setPending(s, null);
    } else return fail("Сначала завершите текущее действие.");
  } else if (move.type === "draw") {
    if (s.deck.length === 0) finish(s, "empty");
    else {
      const card = s.deck.shift()!;
      for (const id of Object.keys(s.known)) s.known[id] = s.known[id].slice(1);
      s.effect = "draw";
      if (card.type === T.danger) {
        s.effect = "danger";
        log(s, `${p.name}: Папа с ремнём! Взрыв нельзя отменить.`);
        if (p.hand.some((c) => c.type === T.defuse))
          setPending(s, { kind: "danger", card });
        else {
          p.alive = false;
          s.discard.push(...p.hand, card);
          p.hand = [];
          forget(s);
          log(s, `${p.name} выбывает без защиты.`);
          if (s.players.filter((p) => p.alive).length === 1) finish(s, "last");
          else {
            s.active = nextAlive(s);
            s.remaining = 1;
            s.attacked = false;
            s.turn++;
          }
        }
      } else {
        p.hand.push(card);
        log(s, `${p.name} берёт карту и завершает одно обязательство.`);
        endObligation(s);
      }
    }
  } else if (move.type === "play" || move.type === "combo") {
    const view = viewFor(s, p.id);
    if (move.type === "play" && !playable(view, move.cardId))
      return fail("У этой карты нет допустимого одиночного действия.");
    if (move.type === "combo" && !comboable(view, move.cardIds))
      return fail("Нужны две или три разные физические карты одного типа.");
    const ids = move.type === "play" ? [move.cardId] : move.cardIds;
    const cards = ids.map((id) => removeCard(p.hand, id)!);
    s.discard.push(...cards);
    s.effect = "play";
    const source = cards[0].type;
    const size = cards.length as 1 | 2 | 3;
    const effect =
      move.type === "combo"
        ? size === 2
          ? "pair"
          : "triple"
        : SINGLE_EFFECTS[source]!;
    const action: ActionPlan = { actorId: p.id, effect, source, size };
    log(
      s,
      `${p.name}: ${size === 1 ? CARDS[source].name : `${size} одинаковые карты «${CARDS[source].name}»`}.`,
    );
    if (effect === "favor" || effect === "pair" || effect === "triple")
      setPending(s, { kind: "target", action });
    else beginNope(s, action);
  } else return fail("Сейчас это действие недоступно.");
  s.revision++;
  return { state: s };
}
export function commandFor(s: GameState, move: Command["move"]): Command {
  return { actor: decisionPlayerId(s), revision: s.revision, move };
}
export function allCards(s: GameState): Card[] {
  return [
    ...s.deck,
    ...s.discard,
    ...s.excluded,
    ...s.players.flatMap((p) => p.hand),
    ...(s.pending?.kind === "danger" || s.pending?.kind === "insert"
      ? [s.pending.card]
      : []),
  ];
}
export function cardCounts(s: GameState): Record<CardType, number> {
  const all = allCards(s);
  return Object.fromEntries(
    CARD_TYPES.map((type) => [type, all.filter((c) => c.type === type).length]),
  ) as Record<CardType, number>;
}
