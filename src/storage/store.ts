import { create } from "zustand";
import {
  applyAction,
  newGame,
  viewFor,
  type Command,
  type GameConfig,
  type GameState,
} from "../game-engine";
import {
  loadGame,
  saveGame,
  loadSettings,
  SETTINGS_KEY,
  type Settings,
} from "./index";
import { chooseMove } from "../bots";
const storage = () => window.localStorage;
let initial: { game: GameState | null; error?: string } = { game: null };
let settings: Settings = { animations: true, sound: false };
try {
  initial = loadGame(storage());
  settings = loadSettings(storage());
} catch {
  initial = {
    game: null,
    error: "Память браузера недоступна. Можно играть без сохранения.",
  };
}
interface AppState {
  game: GameState | null;
  screen: "home" | "game";
  revealed: string | null;
  settings: Settings;
  error: string | null;
  start: (config: GameConfig) => void;
  send: (command: Command) => void;
  botStep: () => void;
  reveal: () => void;
  resume: () => void;
  home: () => void;
  configure: (patch: Partial<Settings>) => void;
  clearError: () => void;
}
const token = (game: GameState) => `${game.id}:${game.turn}`;
function persist(game: GameState): string | null {
  try {
    saveGame(storage(), game);
    return null;
  } catch {
    return "Не удалось сохранить партию: память браузера недоступна или заполнена. Не закрывайте вкладку.";
  }
}
export const useGameStore = create<AppState>((set, get) => ({
  game: initial.game,
  screen: "home",
  revealed: null,
  settings,
  error: initial.error ?? null,
  start: (config) => {
    try {
      const game = newGame(config);
      set({ game, screen: "game", revealed: null, error: persist(game) });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Не удалось начать игру.",
      });
    }
  },
  send: (command) => {
    const game = get().game;
    if (!game) return;
    const result = applyAction(game, command);
    if (result.error) {
      set({ error: result.error });
      return;
    }
    set({ game: result.state, error: persist(result.state) });
  },
  botStep: () => {
    const { game, screen } = get();
    if (
      !game ||
      screen !== "game" ||
      game.status !== "playing" ||
      !game.players[game.active].bot
    )
      return;
    const actor = game.players[game.active].id;
    // AI получает только view, а не game. Применение решения снова проходит валидацию движка.
    const move = chooseMove(viewFor(game, actor));
    get().send({ actor, revision: game.revision, move });
  },
  reveal: () => {
    const game = get().game;
    if (game) set({ revealed: token(game) });
  },
  resume: () => set({ screen: "game", revealed: null, error: null }),
  home: () => set({ screen: "home", revealed: null }),
  configure: (patch) => {
    const settings = { ...get().settings, ...patch };
    try {
      storage().setItem(SETTINGS_KEY, JSON.stringify(settings));
      set({ settings });
    } catch {
      set({
        settings,
        error: "Настройки применены, но браузер не разрешил их сохранить.",
      });
    }
  },
  clearError: () => set({ error: null }),
}));
export function needsHandoff(game: GameState, revealed: string | null) {
  return (
    game.config.mode === "local" &&
    game.status === "playing" &&
    revealed !== token(game)
  );
}
