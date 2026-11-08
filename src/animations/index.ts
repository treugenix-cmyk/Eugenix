import type { Effect } from "../game-engine";
let context: AudioContext | null = null;
export function unlockAudio() {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
  } catch {
    /* Звук необязателен. */
  }
}
export function soundEffect(effect: Effect) {
  try {
    if (!context || context.state !== "running") return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const frequency =
      effect === "danger"
        ? 140
        : effect === "win"
          ? 660
          : effect === "rescue"
            ? 520
            : 330;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * (effect === "danger" ? 0.6 : 1.3),
      now + 0.12,
    );
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch {
    /* Блокировка аудио не прерывает игру. */
  }
}
