import { useState } from "react";
import { CARDS, CARD_TYPES, T, imagePath, type CardType } from "../cards";
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
  const [requested, setRequested] = useState<CardType>(T.defuse);
  const pending = view.pending;
  if (!pending) return null;
  if (pending.kind === "danger")
    return (
      <Modal title="Папа с ремнём!">
        <div className="danger-scene">
          <img src={imagePath(T.danger)} alt="Папа с ремнём" />
        </div>
        <p>
          Взрыв нельзя отменить картой NOPE. Используйте «Маму с салатом», чтобы
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
          Тайно верните Папу. Позиция 1 — верх, {view.deckCount + 1} — низ.
          Завершится одно обязательство; оставшиеся после атаки сохранятся.
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
  if (pending.kind === "target")
    return (
      <Modal
        title={
          pending.action.effect === "favor"
            ? "У кого попросить карту?"
            : pending.action.effect === "pair"
              ? "У кого забрать случайную карту?"
              : "У кого запросить конкретную карту?"
        }
      >
        <p>
          {pending.action.effect === "favor"
            ? "Соперник сам выберет, что отдать."
            : pending.action.effect === "pair"
              ? "После окна отмены движок случайно выберет одну карту соперника."
              : "Назовите желаемый тип. Если у соперника его нет, вы ничего не получите."}
        </p>
        <label>
          Соперник
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {opponents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.cardCount} карт
              </option>
            ))}
          </select>
        </label>
        {pending.action.effect === "triple" && (
          <label>
            Какую карту?
            <select
              value={requested}
              onChange={(e) => setRequested(e.target.value as CardType)}
            >
              {CARD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CARDS[type].name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="primary w-full"
          disabled={!target}
          onClick={() =>
            send({
              type: "target",
              targetId: target,
              ...(pending.action.effect === "triple"
                ? { cardType: requested }
                : {}),
            })
          }
        >
          Подтвердить цель
        </button>
      </Modal>
    );
  if (pending.kind === "nope") {
    const nope = view.hand.find((c) => c.type === T.nope);
    const origin = view.players.find((p) => p.id === pending.action.actorId);
    return (
      <Modal title="Окно отмены · NOPE">
        <p>
          <strong>{origin?.name}</strong>:{" "}
          {pending.action.size === 1
            ? CARDS[pending.action.source].name
            : `комбинация из ${pending.action.size} карт «${CARDS[pending.action.source].name}»`}
        </p>
        {pending.action.targetId && (
          <p>
            Цель:{" "}
            {view.players.find((p) => p.id === pending.action.targetId)?.name}.
            {pending.action.requestedType && (
              <> Запрошено: {CARDS[pending.action.requestedType].name}.</>
            )}
          </p>
        )}
        <p className="reaction-state">
          {pending.cancelled
            ? "Сейчас действие отменено. Ещё одна NOPE восстановит его."
            : "Сейчас действие активно. NOPE отменит его."}
        </p>
        <p>
          Решает {view.players.find((p) => p.id === view.id)?.name}. Можно
          ответить вне собственного хода. После всех ответов окно закроется.
        </p>
        <button
          className="primary w-full"
          disabled={!nope}
          onClick={() => nope && send({ type: "nope", cardId: nope.id })}
        >
          {nope ? "Сыграть NOPE" : "В руке нет NOPE"}
        </button>
        <button
          className="secondary w-full"
          onClick={() => send({ type: "pass" })}
        >
          Не отменять — дальше
        </button>
      </Modal>
    );
  }
  return (
    <Modal title="Выберите карту, которую отдадите">
      <p>
        {view.players.find((p) => p.id === pending.toId)?.name} просит одну
        карту. Вы выбираете сами. Остальная рука останется тайной.
      </p>
      <div className="choice-cards">
        {view.hand.map((card) => (
          <CardButton
            key={card.id}
            type={card.type}
            animate={animate}
            onClick={() => send({ type: "give", cardId: card.id })}
          />
        ))}
      </div>
    </Modal>
  );
}
