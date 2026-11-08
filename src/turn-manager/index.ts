import type { GameState } from "../game-engine/types";
export function nextAlive(s: GameState, from = s.active) {
  for (let step = 1; step <= s.players.length; step++) {
    const i =
      (from + s.direction * step + s.players.length * step) % s.players.length;
    if (s.players[i].alive) return i;
  }
  throw new Error("В партии нет оставшихся игроков.");
}
export function endObligation(s: GameState, stay = false) {
  s.remaining--;
  s.turn++;
  if (s.remaining === 0) {
    s.active = stay ? s.active : nextAlive(s);
    s.remaining = 1;
    s.attacked = false;
  }
}
export function passAttack(s: GameState) {
  s.remaining = s.attacked ? s.remaining + 2 : 2;
  s.active = nextAlive(s);
  s.attacked = true;
  s.turn++;
}
