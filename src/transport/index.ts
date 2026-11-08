import {
  applyAction,
  viewFor,
  type Command,
  type GameState,
  type PlayerView,
  type Result,
} from "../game-engine";
// Будущий WebSocket-сервер реализует этот контракт и хранит GameState только у себя.
// Клиенту передаётся PlayerView, сообщения привязаны к аутентифицированному actor и revision.
export interface GameTransport {
  send(command: Command): Promise<{ view: PlayerView; error?: string }>;
  close(): void;
}
export class LocalTransport implements GameTransport {
  constructor(
    private state: GameState,
    private readonly playerId: string,
  ) {}
  async send(command: Command) {
    const result: Result =
      command.actor === this.playerId
        ? applyAction(this.state, command)
        : { state: this.state, error: "Чужой игрок." };
    this.state = result.state;
    return { view: viewFor(this.state, this.playerId), error: result.error };
  }
  close() {}
}
