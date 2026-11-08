import { CARDS, type CardType } from "../cards";
import { deal, shuffle, type Random } from "../deck";
import { endObligation, nextAlive, passAttack } from "../turn-manager";
import type { Command, GameConfig, GameState, PlayerView } from "./types";
export * from "./types";
export function newGame(
  config: GameConfig,
  random: Random = Math.random,
): GameState {
  if (
    !["bots", "local"].includes(config.mode) ||
    !["easy", "medium", "hard"].includes(config.difficulty)
  )
    throw new Error("Некорректные настройки игры.");
  const { hands, deck } = deal(config.players, random);
  return {
    version: 1,
    id:
      globalThis.crypto?.randomUUID?.() ??
      `game-${Date.now().toString(36)}-${random().toString(36).slice(2)}`,
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
    discard: [],
    active: 0,
    direction: 1,
    remaining: 1,
    attacked: false,
    turn: 1,
    revision: 0,
    pending: null,
    known: {},
    log: [
      "Карты розданы. В каждой семье — по одной Маме и четыре безопасные карты.",
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
function forget(s: GameState) {
  s.known = {};
}
function finish(s: GameState, reason: "last" | "empty") {
  s.active = s.players.findIndex((p) => p.alive);
  s.status = "finished";
  s.endReason = reason;
  s.pending = null;
  s.winners = s.players.filter((p) => p.alive).map((p) => p.id);
  s.effect = "win";
  log(
    s,
    reason === "empty"
      ? "Колода пуста: оставшиеся игроки делят победу."
      : `${s.players.find((p) => p.alive)?.name} — победитель!`,
  );
}
export function playable(view: PlayerView, cardId: string): boolean {
  if (view.status !== "playing" || view.pending || view.activeId !== view.id)
    return false;
  const card = view.hand.find((c) => c.id === cardId);
  if (!card || card.type === "danger" || card.type === "defuse") return false;
  if ((card.type === "top" || card.type === "bottom") && view.hand.length < 2)
    return false;
  if (
    card.type === "request" &&
    !view.players.some((p) => p.id !== view.id && p.alive && p.cardCount > 0)
  )
    return false;
  return true;
}
export function viewFor(s: GameState, playerId: string): PlayerView {
  const p = s.players.find((p) => p.id === playerId);
  if (!p) throw new Error("Игрок не найден.");
  const active = s.players[s.active].id === playerId;
  // Никогда не отдаём клиенту/боту чужие руки, порядок колоды или чужой просмотр.
  return structuredClone({
    id: p.id,
    revision: s.revision,
    turn: s.turn,
    config: s.config,
    players: s.players.map(({ hand, ...rest }) => ({
      ...rest,
      cardCount: hand.length,
    })),
    activeId: s.players[s.active].id,
    direction: s.direction,
    remaining: s.remaining,
    attacked: s.attacked,
    hand: p.hand,
    deckCount: s.deck.length,
    discard: s.discard,
    pending: active ? s.pending : null,
    knownTop: s.known[playerId] ?? [],
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
  if (original.players[original.active].id !== command.actor)
    return fail("Сейчас ход другого игрока.");
  const s = structuredClone(original);
  const p = s.players[s.active];
  const move = command.move;
  const pending = s.pending;
  const remove = (id: string) => {
    const i = p.hand.findIndex((c) => c.id === id);
    return i < 0 ? null : p.hand.splice(i, 1)[0];
  };
  if (pending) {
    if (pending.kind === "danger" && move.type === "defend") {
      const defense = p.hand.find((c) => c.type === "defuse");
      if (!defense) return fail("Нет защитной карты.");
      s.discard.push(remove(defense.id)!);
      s.pending = { kind: "insert", card: pending.card };
      s.effect = "rescue";
      log(s, `${p.name}: Мама с салатом спасает от опасности!`);
    } else if (pending.kind === "insert" && move.type === "insert") {
      if (
        !Number.isInteger(move.position) ||
        move.position < 0 ||
        move.position > s.deck.length
      )
        return fail("Выберите существующую позицию колоды.");
      s.deck.splice(move.position, 0, pending.card);
      s.pending = null;
      forget(s);
      if (move.position === 0) s.known[p.id] = ["danger"];
      log(s, `${p.name} тайно возвращает опасную карту в колоду.`);
      endObligation(s);
      s.effect = "draw";
    } else if (pending.kind === "peek" && move.type === "ack") {
      s.pending = null;
      s.effect = "play";
    } else if (pending.kind === "request" && move.type === "request") {
      const target = s.players.find((t) => t.id === move.targetId);
      if (
        !target ||
        !target.alive ||
        target.id === p.id ||
        move.cardType === "danger" ||
        !Object.hasOwn(CARDS, move.cardType)
      )
        return fail("Выберите живого соперника и безопасный тип карты.");
      const i = target.hand.findIndex((c) => c.type === move.cardType);
      if (i >= 0) p.hand.push(target.hand.splice(i, 1)[0]);
      log(
        s,
        `${p.name} просит у ${target.name}: «${CARDS[move.cardType].name}». ${i >= 0 ? "Карта передана." : "Такой карты нет."}`,
      );
      s.pending = null;
      s.effect = "play";
    } else if (pending.kind === "place" && move.type === "place") {
      const card = remove(move.cardId);
      if (!card || card.type === "danger")
        return fail("Выберите другую карту из руки.");
      if (pending.where === "top") s.deck.unshift(card);
      else s.deck.push(card);
      forget(s);
      if (pending.where === "top") s.known[p.id] = [card.type];
      s.pending = null;
      s.effect = "play";
      log(
        s,
        `${p.name} кладёт карту ${pending.where === "top" ? "наверх" : "под низ"} колоды.`,
      );
    } else return fail("Сначала завершите текущее действие.");
  } else if (move.type === "draw") {
    if (!s.deck.length) {
      finish(s, "empty");
    } else {
      const card = s.deck.shift()!;
      for (const id of Object.keys(s.known)) s.known[id] = s.known[id].slice(1);
      s.effect = "draw";
      if (card.type === "danger") {
        s.effect = "danger";
        log(s, `${p.name}: Папа с ремнём!`);
        if (p.hand.some((c) => c.type === "defuse"))
          s.pending = { kind: "danger", card };
        else {
          p.alive = false;
          s.discard.push(...p.hand, card);
          p.hand = [];
          forget(s);
          log(s, `${p.name} выбывает: защиты не оказалось.`);
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
        log(s, `${p.name} берёт карту и завершает один ход.`);
        endObligation(s);
      }
    }
  } else if (move.type === "play") {
    if (!playable(viewFor(s, p.id), move.cardId))
      return fail("Эту карту сейчас нельзя разыграть.");
    const card = remove(move.cardId)!;
    s.discard.push(card);
    log(s, `${p.name}: ${CARDS[card.type].name}.`);
    s.effect = "play";
    switch (card.type) {
      case "skip":
        endObligation(s);
        break;
      case "reverse":
        s.direction = s.direction === 1 ? -1 : 1;
        s.effect = "reverse";
        if (s.players.filter((p) => p.alive).length === 2)
          endObligation(s, true);
        break;
      case "attack":
        passAttack(s);
        break;
      case "peek": {
        const cards = s.deck.slice(0, 3).map((c) => c.type);
        s.known[p.id] = cards;
        s.pending = { kind: "peek", cards };
        break;
      }
      case "shuffle":
        s.deck = shuffle(s.deck, random);
        forget(s);
        s.effect = "shuffle";
        break;
      case "request":
        s.pending = { kind: "request" };
        break;
      case "top":
        s.pending = { kind: "place", where: "top" };
        break;
      case "bottom":
        s.pending = { kind: "place", where: "bottom" };
        break;
    }
  } else return fail("Сейчас это действие недоступно.");
  s.revision++;
  return { state: s };
}
export function commandFor(s: GameState, move: Command["move"]): Command {
  return { actor: s.players[s.active].id, revision: s.revision, move };
}
export function cardCounts(s: GameState): Record<CardType, number> {
  const cards = [
    ...s.deck,
    ...s.discard,
    ...s.players.flatMap((p) => p.hand),
    ...(s.pending?.kind === "danger" || s.pending?.kind === "insert"
      ? [s.pending.card]
      : []),
  ];
  return Object.fromEntries(
    Object.keys(CARDS).map((type) => [
      type,
      cards.filter((c) => c.type === type).length,
    ]),
  ) as Record<CardType, number>;
}
