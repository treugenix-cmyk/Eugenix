export const CARD_TYPES = [
  "danger",
  "defuse",
  "skip",
  "reverse",
  "attack",
  "peek",
  "shuffle",
  "request",
  "top",
  "bottom",
] as const;
export type CardType = (typeof CARD_TYPES)[number];
export interface Card {
  id: string;
  type: CardType;
}
export interface CardDefinition {
  name: string;
  short: string;
  count: number;
  color: string;
  description: string;
}
export const CARDS: Record<CardType, CardDefinition> = {
  danger: {
    name: "Папа с ремнём",
    short: "Переполох",
    count: 4,
    color: "#ed776d",
    description: "Опасность! Нужна «Мама с салатом», иначе вы выбываете.",
  },
  defuse: {
    name: "Мама с салатом",
    short: "Спасение",
    count: 6,
    color: "#8fc49a",
    description: "Спасает от опасности. Затем тайно верните Папу в колоду.",
  },
  skip: {
    name: "Таня с градусником",
    short: "Пропуск",
    count: 4,
    color: "#88addd",
    description: "Завершите один обязательный ход без взятия карты.",
  },
  reverse: {
    name: "Зоя выгоняет из комнаты",
    short: "Разворот",
    count: 4,
    color: "#b9a1d8",
    description:
      "Разверните очередь. Вдвоём — завершите один свой ход и пропустите соперника.",
  },
  attack: {
    name: "Маша и Аркаша подрались",
    short: "Два хода",
    count: 4,
    color: "#efad71",
    description:
      "Передайте ход: следующий игрок выполняет два хода, а при ответной атаке — оставшиеся плюс два.",
  },
  peek: {
    name: "Зоя смотрит в бинокль",
    short: "Подсмотреть",
    count: 5,
    color: "#e7a8c6",
    description: "Тайно посмотрите до трёх верхних карт, не меняя их порядок.",
  },
  shuffle: {
    name: "Аркаша разбросал LEGO",
    short: "Перемешать",
    count: 4,
    color: "#d5bc95",
    description:
      "Перемешайте только колоду. Предыдущие подсказки о порядке забудутся.",
  },
  request: {
    name: "Маша делает уроки с мамой",
    short: "Попросить",
    count: 4,
    color: "#83c9c2",
    description:
      "Попросите конкретный безопасный тип карты у живого соперника.",
  },
  top: {
    name: "Зоя просит денег у папы",
    short: "Наверх",
    count: 2,
    color: "#efd17c",
    description:
      "Положите другую карту из руки наверх колоды. Продолжайте ход.",
  },
  bottom: {
    name: "Таня кладёт денежки в копилку",
    short: "Под низ",
    count: 2,
    color: "#9dcfdf",
    description:
      "Положите другую карту из руки под низ колоды. Продолжайте ход.",
  },
};
export const SAFE_TYPES = CARD_TYPES.filter((type) => type !== "danger");
