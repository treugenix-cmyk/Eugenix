import { CARDS, CARD_TYPES, type Card, type CardType } from "../cards";
import { cardCounts, type GameState } from "../game-engine";
export const GAME_KEY = "family-chaos.game.v1";
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
const types = (x: unknown): x is CardType[] =>
  Array.isArray(x) && x.every((t) => CARD_TYPES.includes(t));
const cards = (x: unknown): x is Card[] =>
  Array.isArray(x) &&
  x.every(
    (c) =>
      object(c) &&
      typeof c.id === "string" &&
      CARD_TYPES.includes(c.type as CardType),
  );
export function isGameState(value: unknown): value is GameState {
  try {
    if (!object(value)) return false;
    const s = value;
    if (
      s.version !== 1 ||
      typeof s.id !== "string" ||
      !object(s.config) ||
      !["bots", "local"].includes(String(s.config.mode)) ||
      !["easy", "medium", "hard"].includes(String(s.config.difficulty)) ||
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
      !integer(s.active) ||
      Number(s.active) >= s.players.length ||
      ![1, -1].includes(Number(s.direction)) ||
      !integer(s.remaining, 1) ||
      typeof s.attacked !== "boolean" ||
      !integer(s.turn, 1) ||
      !integer(s.revision)
    )
      return false;
    if (
      !["playing", "finished"].includes(String(s.status)) ||
      ![
        "deal",
        "draw",
        "play",
        "danger",
        "rescue",
        "shuffle",
        "reverse",
        "win",
      ].includes(String(s.effect))
    )
      return false;
    if (
      !Array.isArray(s.log) ||
      !s.log.every((l) => typeof l === "string") ||
      !Array.isArray(s.winners) ||
      !s.winners.every((w) => typeof w === "string") ||
      ![null, "last", "empty"].includes(s.endReason as null)
    )
      return false;
    if (!object(s.known) || !Object.values(s.known).every(types)) return false;
    if (s.pending !== null) {
      if (!object(s.pending)) return false;
      const p = s.pending;
      if (p.kind === "danger" || p.kind === "insert") {
        if (!cards([p.card]) || (p.card as Card).type !== "danger")
          return false;
      } else if (p.kind === "peek") {
        if (!types(p.cards) || p.cards.length > 3) return false;
      } else if (p.kind === "place") {
        if (!["top", "bottom"].includes(String(p.where))) return false;
      } else if (p.kind !== "request") return false;
    }
    const game = value as unknown as GameState;
    const ids = game.players.map((p) => p.id);
    if (new Set(ids).size !== ids.length || !game.players[game.active].alive)
      return false;
    if (game.players.some((p) => p.hand.some((c) => c.type === "danger")))
      return false;
    if (Object.keys(game.known).some((id) => !ids.includes(id))) return false;
    if (
      game.status === "playing" &&
      (game.winners.length !== 0 ||
        game.endReason !== null ||
        game.players.filter((p) => p.alive).length < 2)
    )
      return false;
    if (
      game.status === "finished" &&
      (game.pending !== null ||
        game.winners.length === 0 ||
        game.endReason === null ||
        game.winners.some(
          (id) => !game.players.some((p) => p.alive && p.id === id),
        ))
    )
      return false;
    const all = [
      ...game.deck,
      ...game.discard,
      ...game.players.flatMap((p) => p.hand),
      ...(game.pending?.kind === "danger" || game.pending?.kind === "insert"
        ? [game.pending.card]
        : []),
    ];
    if (new Set(all.map((c) => c.id)).size !== all.length) return false;
    const counts = cardCounts(game);
    return CARD_TYPES.every(
      (type) =>
        counts[type] ===
        (type === "danger" ? game.players.length - 1 : CARDS[type].count),
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
    if (!raw) return { game: null };
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
