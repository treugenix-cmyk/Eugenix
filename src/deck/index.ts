import { CARDS, CARD_TYPES, T, type Card } from "../cards";
export type Random = () => number;
export function shuffle<T>(
  cards: readonly T[],
  random: Random = Math.random,
): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createDeck(): Card[] {
  return CARD_TYPES.flatMap((type) =>
    Array.from({ length: CARDS[type].count }, (_, i) => ({
      id: `${type}-${i}`,
      type,
    })),
  );
}
export function deal(count: number, random: Random = Math.random) {
  if (!Number.isInteger(count) || count < 2 || count > 5)
    throw new Error("Нужно от 2 до 5 игроков.");
  const full = createDeck();
  const defenses = full.filter((c) => c.type === T.defuse);
  const dangers = full.filter((c) => c.type === T.danger);
  const safe = shuffle(
    full.filter((c) => c.type !== T.danger && c.type !== T.defuse),
    random,
  );
  if (
    defenses.length < count ||
    safe.length < count * 7 ||
    dangers.length < count - 1
  )
    throw new Error("Недостаточно карт для безопасной раздачи.");
  const hands = Array.from({ length: count }, (_, i) => [
    defenses[i],
    ...safe.splice(0, 7),
  ]);
  const extraDefenses = defenses.slice(count, count + 2);
  return {
    hands,
    deck: shuffle(
      [...safe, ...extraDefenses, ...dangers.slice(0, count - 1)],
      random,
    ),
    excluded: [
      ...defenses.slice(count + extraDefenses.length),
      ...dangers.slice(count - 1),
    ],
  };
}
