import { CARD_TYPES, T, type Card } from "../cards";
import { playable, type Move, type PlayerView } from "../game-engine";
import type { Random } from "../deck";
// Только PlayerView: ни чужих рук, ни неизвестного порядка колоды.
export function chooseMove(v: PlayerView, random: Random = Math.random): Move {
  const pick = <I>(items: I[]) => items[Math.floor(random() * items.length)];
  const opponents = v.players.filter((p) => p.alive && p.id !== v.id);
  const weakest = (cards: Card[]) =>
    [...cards].sort(
      (a, b) =>
        Number(a.type === T.defuse) - Number(b.type === T.defuse) ||
        Number(a.type === T.nope) - Number(b.type === T.nope),
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
      case "target":
        return {
          type: "target",
          targetId: pick(
            opponents.filter((p) => p.cardCount > 0).length
              ? opponents.filter((p) => p.cardCount > 0)
              : opponents,
          ).id,
          ...(v.pending.action.effect === "triple"
            ? {
                cardType:
                  v.config.difficulty === "easy" ? pick(CARD_TYPES) : T.defuse,
              }
            : {}),
        };
      case "give":
        return {
          type: "give",
          cardId: (v.config.difficulty === "easy"
            ? pick(v.hand)
            : weakest(v.hand)
          ).id,
        };
      case "nope": {
        const nope = v.hand.find((c) => c.type === T.nope);
        const action = v.pending.action;
        const harmsMe =
          (action.effect === "attack" &&
            v.players.filter((p) => p.alive)[
              (v.players
                .filter((p) => p.alive)
                .findIndex((p) => p.id === action.actorId) +
                1) %
                v.players.filter((p) => p.alive).length
            ]?.id === v.id) ||
          action.targetId === v.id;
        const wantActive = action.actorId === v.id || !harmsMe;
        const answer =
          v.config.difficulty === "easy"
            ? random() < 0.25
            : v.pending.cancelled === wantActive &&
              (action.actorId === v.id || harmsMe);
        return nope && answer
          ? { type: "nope", cardId: nope.id }
          : { type: "pass" };
      }
    }
  }
  const options = v.hand.filter((c) => playable(v, c.id));
  const play = (card: Card): Move => ({ type: "play", cardId: card.id });
  const group = CARD_TYPES.map((type) => v.hand.filter((c) => c.type === type));
  const matching = group.filter(
    (cards) => cards.length >= 2 && cards[0].type !== T.defuse,
  );
  const combo = () => {
    const cards = pick(matching);
    return {
      type: "combo",
      cardIds: cards.slice(0, cards.length >= 3 ? 3 : 2).map((c) => c.id),
    } as Move;
  };
  if (v.config.difficulty === "easy") {
    if (matching.length && random() < 0.2) return combo();
    return options.length && random() < 0.45
      ? play(pick(options))
      : { type: "draw" };
  }
  const find = (types: Card["type"][]) =>
    types.flatMap((type) => options.filter((c) => c.type === type))[0];
  const risk = v.deckCount ? v.dangerEstimate / v.deckCount : 0;
  const danger = v.knownTop[0] === T.danger;
  const safe = v.knownTop.length > 0 && !danger;
  if (
    danger ||
    v.remaining > 1 ||
    (!safe &&
      v.config.difficulty === "hard" &&
      risk > (opponents.length > 2 ? 0.18 : 0.25))
  ) {
    const escape = find([T.attack, T.skip, T.shuffle]);
    if (escape) return play(escape);
  }
  if (!v.hand.some((c) => c.type === T.defuse)) {
    const favor = find([T.favor]);
    if (favor) return play(favor);
  }
  if (!v.knownTop.length) {
    const peek = find([T.peek]);
    if (peek) return play(peek);
  }
  const cats = matching.filter(
    (cards) => !playable(v, cards[0].id) && cards[0].type !== T.nope,
  );
  if (cats.length) {
    const cards = pick(cats);
    return {
      type: "combo",
      cardIds: cards.slice(0, cards.length >= 3 ? 3 : 2).map((c) => c.id),
    };
  }
  return { type: "draw" };
}
