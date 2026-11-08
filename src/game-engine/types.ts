import type { Card, CardType } from "../cards";
export type Difficulty = "easy" | "medium" | "hard";
export interface GameConfig {
  mode: "bots" | "local";
  players: number;
  difficulty: Difficulty;
}
export interface Player {
  id: string;
  name: string;
  bot: boolean;
  alive: boolean;
  hand: Card[];
}
export type Pending =
  | { kind: "danger"; card: Card }
  | { kind: "insert"; card: Card }
  | { kind: "peek"; cards: CardType[] }
  | { kind: "request" }
  | { kind: "place"; where: "top" | "bottom" };
export type Effect =
  | "deal"
  | "draw"
  | "play"
  | "danger"
  | "rescue"
  | "shuffle"
  | "reverse"
  | "win";
export interface GameState {
  version: 1;
  id: string;
  config: GameConfig;
  players: Player[];
  deck: Card[];
  discard: Card[];
  active: number;
  direction: 1 | -1;
  remaining: number;
  attacked: boolean;
  turn: number;
  revision: number;
  pending: Pending | null;
  known: Record<string, CardType[]>;
  log: string[];
  status: "playing" | "finished";
  winners: string[];
  endReason: "last" | "empty" | null;
  effect: Effect;
}
export type Move =
  | { type: "draw" }
  | { type: "play"; cardId: string }
  | { type: "defend" }
  | { type: "insert"; position: number }
  | { type: "ack" }
  | { type: "request"; targetId: string; cardType: CardType }
  | { type: "place"; cardId: string };
export interface Command {
  actor: string;
  revision: number;
  move: Move;
}
export interface PublicPlayer {
  id: string;
  name: string;
  bot: boolean;
  alive: boolean;
  cardCount: number;
}
export interface PlayerView {
  id: string;
  revision: number;
  turn: number;
  config: GameConfig;
  players: PublicPlayer[];
  activeId: string;
  direction: 1 | -1;
  remaining: number;
  attacked: boolean;
  hand: Card[];
  deckCount: number;
  discard: Card[];
  pending: Pending | null;
  knownTop: CardType[];
  dangerEstimate: number;
  log: string[];
  status: GameState["status"];
  winners: string[];
  endReason: GameState["endReason"];
  effect: Effect;
}
