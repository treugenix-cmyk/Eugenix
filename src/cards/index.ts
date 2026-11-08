export const T = {
  danger: "PAPA_BELT",
  defuse: "MAMA_SALAD",
  skip: "TANYA_THERMOMETER",
  nope: "ZOYA_KICKS_OUT",
  attack: "MASHA_ARKASHA_FIGHT",
  peek: "ZOYA_BINOCULARS",
  shuffle: "ARKASHA_LEGO",
  favor: "ZOYA_MONEY",
  homework: "MASHA_HOMEWORK",
  piggy: "TANYA_PIGGY_BANK",
  chinese: "ZOYA_CHINESE",
  dance: "TANYA_DANCES",
  draw: "MASHA_DRAWS",
} as const;
export type CardType = (typeof T)[keyof typeof T];
export const CARD_TYPES = Object.values(T);
export type CardEffect =
  | "EXPLODING"
  | "DEFUSE"
  | "SKIP"
  | "NOPE"
  | "ATTACK"
  | "SEE_FUTURE"
  | "SHUFFLE"
  | "FAVOR"
  | "CAT_1"
  | "CAT_2"
  | "CAT_3"
  | "CAT_4"
  | "CAT_5";
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
  effect: CardEffect;
  image: string;
}
export const CARDS: Record<CardType, CardDefinition> = {
  [T.danger]: {
    name: "Папа с ремнём",
    short: "Взрыв",
    count: 4,
    color: "#ed776d",
    effect: "EXPLODING",
    image: "01_papa_s_remnem.png",
    description:
      "При вытягивании нужна Мама с салатом, иначе вы выбываете. Отменить взрыв нельзя.",
  },
  [T.defuse]: {
    name: "Мама с салатом",
    short: "Обезвредить",
    count: 6,
    color: "#8fc49a",
    effect: "DEFUSE",
    image: "02_mama_s_salatom.png",
    description:
      "Спасает от Папы. Затем тайно верните Папу в колоду. Отменить защиту нельзя.",
  },
  [T.skip]: {
    name: "Таня с градусником",
    short: "Пропуск",
    count: 4,
    color: "#88addd",
    effect: "SKIP",
    image: "03_tanya_s_gradusnikom.png",
    description: "Завершает один обязательный ход без взятия карты.",
  },
  [T.nope]: {
    name: "Зоя выгоняет из комнаты",
    short: "Отмена · NOPE",
    count: 5,
    color: "#b9a1d8",
    effect: "NOPE",
    image: "04_zoya_vygonyaet.png",
    description:
      "Отменяет ожидающее действие или другую отмену, даже вне вашего хода. Не действует на взрыв и защиту.",
  },
  [T.attack]: {
    name: "Маша и Аркаша подрались",
    short: "Атака ×2",
    count: 4,
    color: "#efad71",
    effect: "ATTACK",
    image: "05_masha_arkasha_podralis.png",
    description:
      "Передайте ход: соперник получает два обязательства, а при ответной атаке — оставшиеся плюс два.",
  },
  [T.peek]: {
    name: "Зоя смотрит в бинокль",
    short: "Будущее",
    count: 5,
    color: "#e7a8c6",
    effect: "SEE_FUTURE",
    image: "06_zoya_binokl.png",
    description: "Тайно посмотрите до трёх верхних карт, не меняя порядок.",
  },
  [T.shuffle]: {
    name: "Аркаша разбросал LEGO",
    short: "Перемешать",
    count: 4,
    color: "#d5bc95",
    effect: "SHUFFLE",
    image: "07_arkasha_lego.png",
    description:
      "Перемешивает только оставшуюся колоду; прежний просмотр забывается.",
  },
  [T.favor]: {
    name: "Зоя просит денег у папы",
    short: "Одолжение",
    count: 4,
    color: "#efd17c",
    effect: "FAVOR",
    image: "09_zoya_dengi.png",
    description:
      "Выберите соперника. Он сам выбирает одну карту, которую отдаст вам.",
  },
  [T.homework]: {
    name: "Маша делает уроки с мамой",
    short: "Семейная карта",
    count: 4,
    color: "#83c9c2",
    effect: "CAT_1",
    image: "08_masha_uroki.png",
    description:
      "Без одиночного действия. Соберите две или три одинаковые карты для комбинации.",
  },
  [T.piggy]: {
    name: "Таня кладёт денежки в копилку",
    short: "Семейная карта",
    count: 4,
    color: "#9dcfdf",
    effect: "CAT_2",
    image: "10_tanya_kopilka.png",
    description:
      "Без одиночного действия. Соберите две или три одинаковые карты для комбинации.",
  },
  [T.chinese]: {
    name: "Зоя учит китайский",
    short: "Семейная карта",
    count: 4,
    color: "#b9a1d8",
    effect: "CAT_3",
    image: "11_zoya_uchit_kitayskiy.png",
    description:
      "Без одиночного действия. Соберите две или три одинаковые карты для комбинации.",
  },
  [T.dance]: {
    name: "Таня танцует",
    short: "Семейная карта",
    count: 4,
    color: "#9dcfdf",
    effect: "CAT_4",
    image: "12_tanya_tantsuet.png",
    description:
      "Без одиночного действия. Соберите две или три одинаковые карты для комбинации.",
  },
  [T.draw]: {
    name: "Маша рисует",
    short: "Семейная карта",
    count: 4,
    color: "#e7a8c6",
    effect: "CAT_5",
    image: "13_masha_risuet.png",
    description:
      "Без одиночного действия. Соберите две или три одинаковые карты для комбинации.",
  },
};
export const SAFE_TYPES = CARD_TYPES.filter((t) => t !== T.danger);
export function imagePath(type: CardType) {
  return `${import.meta.env.BASE_URL}cards/family/${CARDS[type].image}`;
}
export function isCat(type: CardType) {
  return CARDS[type].effect.startsWith("CAT_");
}
