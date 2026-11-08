import { SAFE_TYPES, type Card } from "../cards";
import { playable, type Move, type PlayerView } from "../game-engine";
import type { Random } from "../deck";
// Единственный вход бота — отфильтрованное представление; GameState здесь не используется.
export function chooseMove(v: PlayerView, random: Random = Math.random): Move {
  const pick = <T>(items: T[]) =>
    items[Math.min(items.length - 1, Math.floor(random() * items.length))];
  const opponents = v.players.filter((p) => p.id !== v.id && p.alive);
  const weakest = (cards: Card[]) =>
    [...cards].sort(
      (a, b) => Number(a.type === "defuse") - Number(b.type === "defuse"),
    )[0];
  if (v.pending) {
    switch (v.pending.kind) {
      case "danger":
        return { type: "defend" };
      case "insert":
        return {
          type: "insert",
          position:
            v.config.difficulty === "easy"
              ? Math.floor(random() * (v.deckCount + 1))
              : v.remaining > 1
                ? v.deckCount
                : 0,
        };
      case "peek":
        return { type: "ack" };
      case "request":
        return {
          type: "request",
          targetId: pick(opponents).id,
          cardType:
            v.config.difficulty === "easy" ? pick(SAFE_TYPES) : "defuse",
        };
      case "place":
        return {
          type: "place",
          cardId: (v.config.difficulty === "easy"
            ? pick(v.hand)
            : weakest(v.hand)
          ).id,
        };
    }
  }
  const options = v.hand.filter((c) => playable(v, c.id));
  const play = (c: Card): Move => ({ type: "play", cardId: c.id });
  if (v.config.difficulty === "easy")
    return options.length && random() < 0.45
      ? play(pick(options))
      : { type: "draw" };
  const find = (types: Card["type"][]) =>
    types.flatMap((t) => options.filter((c) => c.type === t))[0];
  const risk = v.deckCount ? v.dangerEstimate / v.deckCount : 0;
  const dangerous = v.knownTop[0] === "danger";
  const safe = v.knownTop.length > 0 && !dangerous;
  if (
    dangerous ||
    v.remaining > 1 ||
    (!safe &&
      v.config.difficulty === "hard" &&
      risk > (opponents.length > 2 ? 0.18 : 0.25))
  ) {
    const escape = find([
      "attack",
      "skip",
      ...(v.players.filter((p) => p.alive).length === 2
        ? ["reverse" as const]
        : []),
      "shuffle",
    ]);
    if (escape) return play(escape);
  }
  if (!v.hand.some((c) => c.type === "defuse")) {
    const ask = find(["request"]);
    if (ask) return play(ask);
  }
  if (!v.knownTop.length) {
    const peek = find(["peek"]);
    if (peek) return play(peek);
  }
  if (!safe) {
    const top = find(["top"]);
    if (top && v.hand.some((c) => c.id !== top.id && c.type !== "defuse"))
      return play(top);
  }
  return { type: "draw" };
}
