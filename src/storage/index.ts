import { CARDS, CARD_TYPES, T, type Card, type CardType } from "../cards";
import { createDeck } from "../deck";
import {
  allCards,
  cardCounts,
  decisionPlayerId,
  SINGLE_EFFECTS,
  type GameState,
} from "../game-engine";
export const GAME_KEY = "family-chaos.game.v2";
export const LEGACY_GAME_KEY = "family-chaos.game.v1";
export const SETTINGS_KEY = "family-chaos.settings.v1";
export interface Settings {
  animations: boolean;
  sound: boolean;
}
export const DEFAULT_SETTINGS: Settings = { animations: true, sound: false };
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const integer = (x: unknown, min = 0) =>
  typeof x === "number" && Number.isSafeInteger(x) && x >= min;
const isType = (x: unknown): x is CardType =>
  typeof x === "string" && CARD_TYPES.includes(x as CardType);
const cards = (x: unknown): x is Card[] =>
  Array.isArray(x) &&
  x.every((c) => object(c) && typeof c.id === "string" && isType(c.type));
export function isGameState(value: unknown): value is GameState {
  try {
    if (!object(value)) return false;
    const s = value;
    if (
      s.version !== 2 ||
      typeof s.id !== "string" ||
      !object(s.config) ||
      !["bots", "local"].includes(s.config.mode as string) ||
      !["easy", "medium", "hard"].includes(s.config.difficulty as string) ||
      !integer(s.config.players, 2) ||
      Number(s.config.players) > 5
    )
      return false;
    if (
      !Array.isArray(s.players) ||
      s.players.length !== s.config.players ||
      !s.players.every(
        (p) =>
          object(p) &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          typeof p.bot === "boolean" &&
          typeof p.alive === "boolean" &&
          cards(p.hand) &&
          (!p.alive ? p.hand.length === 0 : true),
      )
    )
      return false;
    if (
      !cards(s.deck) ||
      !cards(s.discard) ||
      !cards(s.excluded) ||
      !integer(s.active) ||
      Number(s.active) >= s.players.length ||
      s.direction !== 1 ||
      !integer(s.remaining, 1) ||
      typeof s.attacked !== "boolean" ||
      !integer(s.turn, 1) ||
      !integer(s.revision)
    )
      return false;
    if (
      !["playing", "finished"].includes(s.status as string) ||
      ![
        "deal",
        "draw",
        "play",
        "danger",
        "rescue",
        "shuffle",
        "cancel",
        "steal",
        "win",
      ].includes(s.effect as string)
    )
      return false;
    if (
      !Array.isArray(s.log) ||
      s.log.length > 60 ||
      !s.log.every((l) => typeof l === "string") ||
      !Array.isArray(s.winners) ||
      !s.winners.every((w) => typeof w === "string") ||
      (s.endReason !== null &&
        s.endReason !== "last" &&
        s.endReason !== "empty")
    )
      return false;
    if (
      !object(s.known) ||
      !Object.values(s.known).every(
        (x) => Array.isArray(x) && x.length <= 3 && x.every(isType),
      )
    )
      return false;
    if (s.pending !== null) {
      if (!object(s.pending)) return false;
      const p = s.pending;
      if (p.kind === "danger" || p.kind === "insert") {
        if (!cards([p.card]) || (p.card as Card).type !== T.danger)
          return false;
      } else if (p.kind === "peek") {
        if (
          !Array.isArray(p.cards) ||
          p.cards.length > 3 ||
          !p.cards.every(isType)
        )
          return false;
      } else if (p.kind === "target" || p.kind === "nope") {
        if (!object(p.action)) return false;
        const a = p.action;
        if (
          typeof a.actorId !== "string" ||
          !isType(a.source) ||
          !integer(a.size, 1) ||
          Number(a.size) > 3 ||
          ![
            "skip",
            "attack",
            "peek",
            "shuffle",
            "favor",
            "pair",
            "triple",
          ].includes(a.effect as string)
        )
          return false;
        if (a.targetId !== undefined && typeof a.targetId !== "string")
          return false;
        if (a.requestedType !== undefined && !isType(a.requestedType))
          return false;
        if (
          p.kind === "nope" &&
          (typeof p.cancelled !== "boolean" ||
            typeof p.responder !== "string" ||
            typeof p.lastActor !== "string" ||
            !Array.isArray(p.passed) ||
            !p.passed.every((x) => typeof x === "string"))
        )
          return false;
      } else if (p.kind === "give") {
        if (typeof p.fromId !== "string" || typeof p.toId !== "string")
          return false;
      } else return false;
    }
    const game = value as unknown as GameState;
    const ids = game.players.map((p) => p.id);
    const living = game.players.filter((p) => p.alive).map((p) => p.id);
    const active = game.players[game.active];
    if (
      new Set(ids).size !== ids.length ||
      !active.alive ||
      (!game.attacked && game.remaining !== 1)
    )
      return false;
    if (game.players.some((p) => p.hand.some((c) => c.type === T.danger)))
      return false;
    if (
      Object.entries(game.known).some(
        ([id, types]) =>
          !ids.includes(id) ||
          types.some((type, i) => game.deck[i]?.type !== type),
      )
    )
      return false;
    if (
      game.status === "playing" &&
      (game.winners.length ||
        game.endReason !== null ||
        living.length < 2 ||
        game.phase !== (game.pending?.kind ?? "turn"))
    )
      return false;
    if (
      game.status === "finished" &&
      (game.pending !== null ||
        game.phase !== "finished" ||
        game.winners.length !== living.length ||
        game.endReason === null ||
        new Set(game.winners).size !== game.winners.length ||
        game.winners.some((id) => !living.includes(id)) ||
        (game.endReason === "last" && living.length !== 1) ||
        (game.endReason === "empty" && game.deck.length !== 0))
    )
      return false;
    const pending = game.pending;
    if (pending?.kind === "target" || pending?.kind === "nope") {
      const a = pending.action;
      if (a.actorId !== active.id || a.source === T.danger) return false;
      if (a.size === 1 && SINGLE_EFFECTS[a.source] !== a.effect) return false;
      if (
        (a.size === 2 && a.effect !== "pair") ||
        (a.size === 3 && a.effect !== "triple")
      )
        return false;
      if (
        pending.kind === "target" &&
        !["favor", "pair", "triple"].includes(a.effect)
      )
        return false;
      if (pending.kind === "nope") {
        if (
          ["favor", "pair", "triple"].includes(a.effect) &&
          (!a.targetId ||
            !living.includes(a.targetId) ||
            a.targetId === active.id)
        )
          return false;
        if (a.effect === "triple" && !a.requestedType) return false;
        if (
          !living.includes(pending.responder) ||
          !living.includes(pending.lastActor) ||
          pending.responder === pending.lastActor ||
          new Set(pending.passed).size !== pending.passed.length ||
          pending.passed.some(
            (id) => !living.includes(id) || id === pending.lastActor,
          ) ||
          pending.passed.includes(pending.responder)
        )
          return false;
      }
    }
    if (
      pending?.kind === "give" &&
      (!living.includes(pending.fromId) ||
        pending.toId !== active.id ||
        pending.fromId === pending.toId ||
        !game.players.find((p) => p.id === pending.fromId)?.hand.length)
    )
      return false;
    if (
      pending?.kind === "danger" &&
      !active.hand.some((c) => c.type === T.defuse)
    )
      return false;
    if (
      pending?.kind === "peek" &&
      pending.cards.some((type, i) => game.deck[i]?.type !== type)
    )
      return false;
    if (!living.includes(decisionPlayerId(game))) return false;
    const all = allCards(game);
    const expected = createDeck();
    const byId = new Map(expected.map((c) => [c.id, c.type]));
    if (
      all.length !== 56 ||
      new Set(all.map((c) => c.id)).size !== 56 ||
      all.some((c) => byId.get(c.id) !== c.type)
    )
      return false;
    const counts = cardCounts(game);
    if (!CARD_TYPES.every((type) => counts[type] === CARDS[type].count))
      return false;
    if (game.excluded.some((c) => c.type !== T.danger && c.type !== T.defuse))
      return false;
    const n = game.players.length;
    return (
      game.excluded.filter((c) => c.type === T.danger).length === 5 - n &&
      game.excluded.filter((c) => c.type === T.defuse).length ===
        Math.max(0, 6 - n - 2)
    );
  } catch {
    return false;
  }
}
export function saveGame(storage: StorageLike, game: GameState) {
  storage.setItem(GAME_KEY, JSON.stringify(game));
}
export function loadGame(storage: StorageLike): {
  game: GameState | null;
  error?: string;
} {
  try {
    const raw = storage.getItem(GAME_KEY);
    if (!raw)
      return storage.getItem(LEGACY_GAME_KEY)
        ? {
            game: null,
            error:
              "Старая партия на 39 картах сохранена отдельно. Правила изменились: начните новую партию на 56 картах.",
          }
        : { game: null };
    const value: unknown = JSON.parse(raw);
    return isGameState(value)
      ? { game: value }
      : {
          game: null,
          error:
            "Сохранение повреждено или имеет другую версию. Начните новую партию.",
        };
  } catch {
    return {
      game: null,
      error:
        "Не удалось прочитать сохранение. Проверьте доступ к памяти браузера.",
    };
  }
}
export function loadSettings(storage: StorageLike): Settings {
  try {
    const x: unknown = JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null");
    return object(x) &&
      typeof x.animations === "boolean" &&
      typeof x.sound === "boolean"
      ? { animations: x.animations, sound: x.sound }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
