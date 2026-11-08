import { CARDS, CARD_TYPES, type Card } from "../cards";
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
  const defenses = full.filter((c) => c.type === "defuse");
  const safe = shuffle(
    full.filter((c) => c.type !== "danger" && c.type !== "defuse"),
    random,
  );
  if (
    defenses.length < count ||
    safe.length < count * 4 ||
    CARDS.danger.count < count - 1
  )
    throw new Error("В конфигурации не хватает карт для безопасной раздачи.");
  const hands = Array.from({ length: count }, (_, i) => [
    defenses[i],
    ...safe.splice(0, 4),
  ]);
  const deck = shuffle(
    [
      ...safe,
      ...defenses.slice(count),
      ...full.filter((c) => c.type === "danger").slice(0, count - 1),
    ],
    random,
  );
  return { hands, deck };
}
