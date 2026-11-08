import { useState } from "react";
import { CARDS, SAFE_TYPES, type CardType } from "../cards";
import type { Move, PlayerView } from "../game-engine";
import { Modal } from "./Modal";
import { CardButton } from "./Card";
export function Choices({
  view,
  send,
  animate,
}: {
  view: PlayerView;
  send: (move: Move) => void;
  animate: boolean;
}) {
  const [position, setPosition] = useState(0);
  const opponents = view.players.filter((p) => p.alive && p.id !== view.id);
  const [target, setTarget] = useState(opponents[0]?.id ?? "");
  const [requested, setRequested] = useState<CardType>("defuse");
  const pending = view.pending;
  if (!pending) return null;
  if (pending.kind === "danger")
    return (
      <Modal title="Папа с ремнём!">
        <div className="danger-scene">
          <img
            src={`${import.meta.env.BASE_URL}cards/danger.svg`}
            alt="Сердитый мультяшный папа"
          />
        </div>
        <p>
          Без паники: у вас есть «Мама с салатом». Используйте её, чтобы
          остаться в игре.
        </p>
        <button
          className="primary w-full"
          onClick={() => send({ type: "defend" })}
        >
          Мама, спаси! 🥗
        </button>
      </Modal>
    );
  if (pending.kind === "insert")
    return (
      <Modal title="Мама спасла! 🥗">
        <p>
          Тайно верните Папу в колоду. Позиция 1 — верх, {view.deckCount + 1} —
          самый низ. Остальные игроки не узнают ваш выбор.
        </p>
        <div className="choice-row">
          <button onClick={() => send({ type: "insert", position: 0 })}>
            Наверх
          </button>
          <button
            onClick={() => send({ type: "insert", position: view.deckCount })}
          >
            Под низ
          </button>
        </div>
        <label>
          Позиция от 1 до {view.deckCount + 1}
          <input
            type="number"
            min={1}
            max={view.deckCount + 1}
            value={position + 1}
            onChange={(e) => setPosition(Number(e.target.value) - 1)}
          />
        </label>
        <button
          className="primary w-full"
          disabled={
            !Number.isInteger(position) ||
            position < 0 ||
            position > view.deckCount
          }
          onClick={() => send({ type: "insert", position })}
        >
          Вернуть в выбранное место
        </button>
      </Modal>
    );
  if (pending.kind === "peek")
    return (
      <Modal title="Тайный взгляд в колоду">
        <p>
          Слева направо: первая, вторая и третья карта сверху. Порядок не
          изменён.
        </p>
        <div className="choice-cards">
          {pending.cards.map((type, i) => (
            <div key={i}>
              <small>{i + 1}-я сверху</small>
              <CardButton type={type} disabled animate={animate} />
            </div>
          ))}
        </div>
        {pending.cards.length === 0 && <p>Колода пуста.</p>}
        <button
          className="primary w-full"
          onClick={() => send({ type: "ack" })}
        >
          Запомнил, закрыть
        </button>
      </Modal>
    );
  if (pending.kind === "request")
    return (
      <Modal title="Попросить карту">
        <label>
          У кого?
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {opponents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.cardCount} карт
              </option>
            ))}
          </select>
        </label>
        <label>
          Какую карту?
          <select
            value={requested}
            onChange={(e) => setRequested(e.target.value as CardType)}
          >
            {SAFE_TYPES.map((type) => (
              <option key={type} value={type}>
                {CARDS[type].name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary w-full"
          disabled={!target}
          onClick={() =>
            send({ type: "request", targetId: target, cardType: requested })
          }
        >
          Попросить
        </button>
      </Modal>
    );
  return (
    <Modal
      title={
        pending.where === "top"
          ? "Какую карту положить наверх?"
          : "Какую карту положить под низ?"
      }
    >
      <p>Выберите другую карту из своей руки. После этого ход продолжится.</p>
      <div className="choice-cards">
        {view.hand.map((card) => (
          <CardButton
            key={card.id}
            type={card.type}
            animate={animate}
            onClick={() => send({ type: "place", cardId: card.id })}
          />
        ))}
      </div>
    </Modal>
  );
}
