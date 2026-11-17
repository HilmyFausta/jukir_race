let music = null;
let context = null;
let enabled = false;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener(enabled));

const ensureAudio = () => {
  if (typeof window === "undefined") return false;
  if (!music) {
    music = new Audio("/assets/backsound.mp3");
    music.loop = true;
    music.volume = 1;
  }
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) context = new AudioContext();
  }
  return true;
};

const enable = async () => {
  if (!ensureAudio()) return false;
  enabled = true;
  if (context?.state === "suspended") await context.resume();
  try {
    await music.play();
  } catch {
    enabled = false;
    notify();
    return false;
  }
  notify();
  return true;
};

const disable = () => {
  if (music) music.pause();
  enabled = false;
  notify();
};

export const sound = {
  isEnabled: () => enabled,
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  toggle: () => (enabled ? disable() : enable()),
  play: (kind = "tap") => {
    if (!enabled || !ensureAudio() || !context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const settings = {
      tap: [520, 2.5, "square"],
      select: [680, 1, "square"],
      move: [300, 0.12, "triangle"],
      error: [130, 0.16, "sawtooth"],
      win: [880, 0.22, "square"],
    }[kind] || [520, 0.045, "square"];
    oscillator.type = settings[2];
    oscillator.frequency.setValueAtTime(settings[0], now);
    if (kind === "move") oscillator.frequency.exponentialRampToValueAtTime(190, now + settings[1]);
    if (kind === "win") oscillator.frequency.exponentialRampToValueAtTime(1320, now + settings[1]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[1]);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + settings[1] + 0.02);
  },
};
