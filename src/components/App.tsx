import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CARDS, T, imagePath, type CardType } from "../cards";
import {
  playable,
  comboable,
  decisionPlayerId,
  viewFor,
  type Difficulty,
  type GameConfig,
  type Move,
} from "../game-engine";
import { useGameStore, needsHandoff } from "../storage/store";
import { soundEffect, unlockAudio } from "../animations";
import { CardButton, CardFace } from "./Card";
import { Choices } from "./Choices";
import { Modal } from "./Modal";
import { Rules } from "./Rules";
export default function App() {
  const {
    game,
    screen,
    revealed,
    settings,
    error,
    start,
    send,
    botStep,
    reveal,
    resume,
    home,
    configure,
    clearError,
  } = useGameStore();
  const [panel, setPanel] = useState<"rules" | "settings" | "new" | null>(null);
  const [config, setConfig] = useState<GameConfig>({
    mode: "bots",
    players: 3,
    difficulty: "medium",
  });
  const [selection, setSelection] = useState<{
    revision: number;
    ids: string[];
  }>({ revision: -1, ids: [] });
  const [comboMode, setComboMode] = useState(false);
  const [zoom, setZoom] = useState<CardType | null>(null);
  const selected = selection.revision === game?.revision ? selection.ids : [];
  const prefersReduced = useReducedMotion();
  const animate = settings.animations && !prefersReduced;
  const active = game?.players[game.active];
  const decider = game?.players.find((p) => p.id === decisionPlayerId(game));
  useEffect(() => {
    if (
      screen !== "game" ||
      game?.status !== "playing" ||
      !decider?.bot ||
      panel ||
      zoom
    )
      return;
    const timer = setTimeout(botStep, animate ? 650 : 100);
    return () => clearTimeout(timer);
  }, [game, screen, decider?.bot, botStep, animate, panel, zoom]);
  useEffect(() => {
    if (game && screen === "game" && settings.sound) soundEffect(game.effect);
  }, [game?.revision, game?.id, screen, settings.sound]);
  const perform = (move: Move) => {
    if (!game || !decider || decider.bot) return;
    if (settings.sound) unlockAudio();
    setSelection({ revision: -1, ids: [] });
    send({ actor: decider.id, revision: game.revision, move });
  };
  const launch = () => {
    setSelection({ revision: -1, ids: [] });
    setComboMode(false);
    setZoom(null);
    if (settings.sound) unlockAudio();
    setPanel(null);
    start(config);
  };
  const modals = (
    <>
      {panel === "rules" && (
        <Modal title="Как устроен переполох" onClose={() => setPanel(null)}>
          <Rules />
        </Modal>
      )}
      {panel === "settings" && (
        <Modal title="Настройки" onClose={() => setPanel(null)}>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.animations}
              onChange={(e) => configure({ animations: e.target.checked })}
            />{" "}
            Анимации
          </label>
          {prefersReduced && (
            <p>В системе включено уменьшение движения — анимации отключены.</p>
          )}
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(e) => {
                if (e.target.checked) unlockAudio();
                configure({ sound: e.target.checked });
              }}
            />{" "}
            Звуковые эффекты
          </label>
          <p>
            Настройки сохраняются на этом устройстве. Звук по умолчанию
            выключен.
          </p>
        </Modal>
      )}
      {panel === "new" && (
        <Modal title="Начать заново?" onClose={() => setPanel(null)}>
          <p>Текущее сохранение будет заменено новой партией.</p>
          <button className="primary w-full" onClick={launch}>
            Начать новую партию
          </button>
        </Modal>
      )}
    </>
  );
  const notice = error && (
    <div className="notice" role="alert">
      <span>{error}</span>
      <button aria-label="Закрыть сообщение" onClick={clearError}>
        ×
      </button>
    </div>
  );
  if (screen === "home" || !game) {
    return (
      <main className="landing">
        {notice}
        <div className="brand-mark" aria-hidden="true">
          ✦
        </div>
        <p className="eyebrow">БОЛЬШАЯ СЕМЬЯ · МАЛЕНЬКИЕ ХИТРОСТИ</p>
        <h1>
          Семейный
          <br />
          <em>переполох</em>
        </h1>
        <p className="lead">
          Карточная комедия, в которой всё решает
          <br className="hidden sm:block" /> одна заботливая мама.
        </p>
        <div className="hero-cards" aria-hidden="true">
          {([T.peek, T.defuse, T.danger] as const).map((type) => (
            <div
              className="playing-card full-art-card"
              key={type}
              style={
                { "--card-color": CARDS[type].color } as React.CSSProperties
              }
            >
              <CardFace type={type} />
            </div>
          ))}
        </div>
        <section className="setup">
          <label>
            С кем играем?
            <select
              value={config.mode}
              onChange={(e) =>
                setConfig({
                  ...config,
                  mode: e.target.value as GameConfig["mode"],
                })
              }
            >
              <option value="bots">С ботами</option>
              <option value="local">С друзьями на одном устройстве</option>
            </select>
          </label>
          <div className="setup-row">
            <label>
              Всего игроков
              <select
                value={config.players}
                onChange={(e) =>
                  setConfig({ ...config, players: Number(e.target.value) })
                }
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {config.mode === "bots" ? ` (вы + ${n - 1} бота)` : ""}
                  </option>
                ))}
              </select>
            </label>
            {config.mode === "bots" && (
              <label>
                Боты
                <select
                  value={config.difficulty}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      difficulty: e.target.value as Difficulty,
                    })
                  }
                >
                  <option value="easy">Лёгкие</option>
                  <option value="medium">Средние</option>
                  <option value="hard">Сложные</option>
                </select>
              </label>
            )}
          </div>
          <button
            className="primary play-button"
            onClick={() => {
              if (game?.status === "playing") setPanel("new");
              else launch();
            }}
          >
            Играть <span>→</span>
          </button>
          {game && (
            <button className="secondary w-full" onClick={resume}>
              {game.status === "finished"
                ? "Результат прошлой партии"
                : "Продолжить партию"}
            </button>
          )}
        </section>
        <nav className="landing-links">
          <button onClick={() => setPanel("rules")}>Правила</button>
          <button onClick={() => setPanel("settings")}>Настройки</button>
        </nav>
        <p className="footnote">
          2–5 игроков · без регистрации · всё на вашем устройстве
        </p>
        {panel === "new" ? (
          <Modal title="Заменить сохранение?" onClose={() => setPanel(null)}>
            <p>Новая игра заменит текущую партию.</p>
            <button className="primary w-full" onClick={launch}>
              Начать новую игру
            </button>
          </Modal>
        ) : (
          modals
        )}
      </main>
    );
  }
  if (needsHandoff(game, revealed))
    return (
      <main className="handoff">
        {notice}
        <div className="handoff-icon" aria-hidden="true">
          🤫
        </div>
        <p className="eyebrow">КАРТЫ НАДЁЖНО СПРЯТАНЫ</p>
        <h1>Передайте устройство</h1>
        <h2>{decider?.name}</h2>
        <p>
          Остальные отворачиваются. Только вы увидите свою руку и тайные
          действия.
        </p>
        <button
          className="primary"
          onClick={() => {
            if (settings.sound) unlockAudio();
            reveal();
          }}
        >
          Я готов — показать карты
        </button>
        <button onClick={home}>В меню</button>
      </main>
    );
  const viewer = game.config.mode === "local" ? decider! : game.players[0];
  const view = viewFor(game, viewer.id);
  const isHumanTurn =
    active?.id === viewer.id &&
    !active.bot &&
    game.status === "playing" &&
    game.phase === "turn";
  const showChoices =
    decider?.id === viewer.id && !decider.bot && view.pending !== null;
  const opponents = view.players.filter((p) => p.id !== viewer.id);
  const shake =
    animate && game.effect === "danger"
      ? { x: [0, -7, 7, -5, 5, 0] }
      : { x: 0 };
  return (
    <main className={`table-page ${animate ? "" : "no-animation"}`}>
      {notice}
      <header className="table-header">
        <button className="wordmark" onClick={home}>
          Семейный <em>переполох</em>
        </button>
        <nav>
          <button aria-label="Правила" onClick={() => setPanel("rules")}>
            ?
          </button>
          <button aria-label="Настройки" onClick={() => setPanel("settings")}>
            ⚙
          </button>
          <button onClick={home}>В меню</button>
        </nav>
      </header>
      <section className="opponents" aria-label="Соперники">
        {opponents.map((p, i) => (
          <div
            key={p.id}
            className={`opponent ${p.id === view.decisionId ? "active" : ""} ${p.alive ? "" : "eliminated"}`}
          >
            <span className="avatar" aria-hidden="true">
              {["🦊", "🐻", "🐰", "🐱"][i]}
            </span>
            <div>
              <strong>{p.name}</strong>
              <small>
                {p.alive
                  ? `${p.cardCount} карт${p.bot ? " · бот" : ""}`
                  : "Выбыл"}
              </small>
            </div>
            {p.id === view.decisionId && (
              <span className="turn-dot" aria-label="Сейчас ходит" />
            )}
          </div>
        ))}
      </section>
      <motion.section
        className="table-felt"
        animate={shake}
        transition={{ duration: animate ? 0.3 : 0 }}
        aria-label="Игровой стол"
      >
        <div className="turn-info">
          <motion.span
            key={view.direction}
            initial={animate ? { rotate: -90 } : false}
            animate={{ rotate: 0 }}
            transition={{ duration: animate ? 0.2 : 0 }}
          >
            {view.direction === 1 ? "↻" : "↺"}
          </motion.span>
          <span>
            {decider?.name}
            {decider?.bot
              ? " думает…"
              : view.phase === "nope"
                ? " — ответ NOPE"
                : view.phase === "give"
                  ? " — передача карты"
                  : " — ваш ход"}
          </span>
          <span className="debt">Ходов: {view.remaining}</span>
        </div>
        <div className="piles">
          <motion.button
            key={`deck-${game.revision}`}
            className="deck-pile"
            disabled={!isHumanTurn || !!view.pending || !!panel}
            onClick={() => perform({ type: "draw" })}
            aria-label="Взять карту и завершить ход"
            initial={
              animate && game.effect === "shuffle" ? { rotate: -7 } : false
            }
            animate={
              animate && game.effect === "shuffle"
                ? { rotate: [-7, 7, -5, 0] }
                : { rotate: 0 }
            }
            transition={{ duration: animate ? 0.3 : 0 }}
          >
            <span className="deck-star">✦</span>
            <strong>ПЕРЕПОЛОХ</strong>
            <small>{view.deckCount} карт</small>
          </motion.button>
          <div className="discard-pile">
            <AnimatePresence mode="wait">
              {view.discard.length ? (
                <motion.div
                  key={view.discard.at(-1)!.id}
                  className="playing-card full-art-card"
                  style={
                    {
                      "--card-color": CARDS[view.discard.at(-1)!.type].color,
                    } as React.CSSProperties
                  }
                  initial={animate ? { opacity: 0, y: -16, rotate: 5 } : false}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: animate ? 0.15 : 0 }}
                >
                  <CardFace type={view.discard.at(-1)!.type} />
                </motion.div>
              ) : (
                <div className="empty-pile">Пока тихо…</div>
              )}
            </AnimatePresence>
            <small>Сброс · {view.discard.length}</small>
          </div>
        </div>
        <p className="table-hint" role="status" aria-live="polite">
          {game.status === "finished"
            ? "Переполох завершён"
            : decider?.bot
              ? "Соперник выбирает действие"
              : !viewer.alive
                ? "Вы наблюдаете за оставшимися игроками"
                : view.pending
                  ? "Завершите выбор в окне"
                  : "Играйте карты или возьмите одну из колоды"}
        </p>
      </motion.section>
      <section
        className={`hand-section ${isHumanTurn ? "active-hand" : ""}`}
        aria-label="Ваша рука"
      >
        <div className="section-heading">
          <h2>
            {viewer.name}: {viewer.alive ? "ваши карты" : "вы выбыли"}
          </h2>
          <span>{view.hand.length} карт</span>
        </div>
        {isHumanTurn && (
          <div className="combo-controls">
            <button
              aria-pressed={comboMode}
              onClick={() => {
                setComboMode(!comboMode);
                setSelection({ revision: game.revision, ids: [] });
              }}
            >
              {comboMode ? "Выйти из выбора" : "Комбинация · 2 или 3 карты"}
            </button>
            {comboMode && (
              <>
                <span>Выбрано: {selected.length} / 3</span>
                <button
                  className="primary"
                  disabled={!comboable(view, selected)}
                  onClick={() => {
                    perform({ type: "combo", cardIds: selected });
                    setComboMode(false);
                  }}
                >
                  Разыграть комбинацию
                </button>
              </>
            )}
          </div>
        )}
        <motion.div
          className="hand"
          key={`${game.id}-${viewer.id}`}
          initial={false}
          animate={
            animate && game.effect === "rescue"
              ? { scale: [1, 1.025, 1] }
              : { scale: 1 }
          }
          transition={{ duration: animate ? 0.25 : 0 }}
        >
          {view.hand.map((card, i) => (
            <div className="card-tile" key={card.id}>
              <CardButton
                type={card.type}
                index={i}
                animate={animate}
                selected={selected.includes(card.id)}
                disabled={
                  !!panel ||
                  !!zoom ||
                  !isHumanTurn ||
                  (!comboMode && !playable(view, card.id)) ||
                  (comboMode &&
                    selected.length > 0 &&
                    !selected.includes(card.id) &&
                    (selected.length >= 3 ||
                      card.type !==
                        view.hand.find((c) => c.id === selected[0])?.type))
                }
                onClick={() => {
                  if (comboMode) {
                    setSelection({
                      revision: game.revision,
                      ids: selected.includes(card.id)
                        ? selected.filter((id) => id !== card.id)
                        : [...selected, card.id],
                    });
                  } else perform({ type: "play", cardId: card.id });
                }}
              />
              <button
                className="zoom-button"
                aria-label={`Увеличить: ${CARDS[card.type].name}`}
                onClick={() => setZoom(card.type)}
              >
                Увеличить
              </button>
            </div>
          ))}
        </motion.div>
        {view.hand.length === 0 && (
          <p className="muted">В руке пока нет карт.</p>
        )}
      </section>
      <section className="event-log" aria-label="Журнал событий">
        <div className="section-heading">
          <h2>За семейным столом</h2>
          <span>Последние события</span>
        </div>
        <ol aria-live="polite" aria-relevant="additions">
          {view.log.slice(0, 8).map((line, i) => (
            <li key={`${game.revision - i}-${line}`}>{line}</li>
          ))}
        </ol>
      </section>
      <footer className="game-footer">
        <span>Сохраняем автоматически на этом устройстве</span>
        <button
          onClick={() => {
            setConfig(game.config);
            setPanel("new");
          }}
        >
          Новая партия
        </button>
      </footer>
      {showChoices && (
        <Choices
          key={`${game.turn}-${view.pending?.kind}-${game.revision}`}
          view={view}
          send={perform}
          animate={animate}
        />
      )}
      {game.status === "finished" && !panel && (
        <Modal
          title={
            view.endReason === "empty"
              ? "Семейное перемирие!"
              : "У нас победитель!"
          }
        >
          <motion.div
            className="winner-art"
            initial={animate ? { scale: 0.7 } : false}
            animate={{ scale: 1 }}
            transition={{ duration: animate ? 0.25 : 0 }}
          >
            🏆
          </motion.div>
          <h3 className="winner-names">
            {view.players
              .filter((p) => view.winners.includes(p.id))
              .map((p) => p.name)
              .join(", ")}
          </h3>
          <p>
            {view.endReason === "empty"
              ? "Колода закончилась. Все оставшиеся игроки делят победу."
              : "Последний за семейным столом. До следующего переполоха!"}
          </p>
          <button
            className="primary w-full"
            onClick={() => {
              setConfig(game.config);
              home();
            }}
          >
            Новая партия
          </button>
          <button
            className="secondary w-full"
            onClick={() => setPanel("rules")}
          >
            Посмотреть правила
          </button>
        </Modal>
      )}
      {zoom && (
        <Modal title={CARDS[zoom].name} onClose={() => setZoom(null)}>
          <img
            className="zoomed-card"
            src={imagePath(zoom)}
            alt={CARDS[zoom].name}
          />
          <p>{CARDS[zoom].description}</p>
        </Modal>
      )}
      {modals}
    </main>
  );
}
