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
export type ActionKind =
  | "skip"
  | "attack"
  | "peek"
  | "shuffle"
  | "favor"
  | "pair"
  | "triple";
export interface ActionPlan {
  actorId: string;
  effect: ActionKind;
  source: CardType;
  size: 1 | 2 | 3;
  targetId?: string;
  requestedType?: CardType;
}
export type Pending =
  | { kind: "danger"; card: Card }
  | { kind: "insert"; card: Card }
  | { kind: "peek"; cards: CardType[] }
  | { kind: "target"; action: ActionPlan }
  | {
      kind: "nope";
      action: ActionPlan;
      cancelled: boolean;
      responder: string;
      lastActor: string;
      passed: string[];
    }
  | { kind: "give"; fromId: string; toId: string };
export type Phase =
  | "turn"
  | "target"
  | "nope"
  | "give"
  | "danger"
  | "insert"
  | "peek"
  | "finished";
export type Effect =
  | "deal"
  | "draw"
  | "play"
  | "danger"
  | "rescue"
  | "shuffle"
  | "cancel"
  | "steal"
  | "win";
export interface GameState {
  version: 2;
  id: string;
  config: GameConfig;
  players: Player[];
  deck: Card[];
  discard: Card[];
  excluded: Card[];
  active: number;
  direction: 1;
  remaining: number;
  attacked: boolean;
  turn: number;
  revision: number;
  phase: Phase;
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
  | { type: "combo"; cardIds: string[] }
  | { type: "target"; targetId: string; cardType?: CardType }
  | { type: "nope"; cardId: string }
  | { type: "pass" }
  | { type: "give"; cardId: string }
  | { type: "defend" }
  | { type: "insert"; position: number }
  | { type: "ack" };
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
  decisionId: string;
  direction: 1;
  remaining: number;
  attacked: boolean;
  phase: Phase;
  hand: Card[];
  deckCount: number;
  discard: Card[];
  excludedCount: number;
  pending: Pending | null;
  knownTop: CardType[];
  dangerEstimate: number;
  log: string[];
  status: GameState["status"];
  winners: string[];
  endReason: GameState["endReason"];
  effect: Effect;
}
