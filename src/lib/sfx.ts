// Synthesized sound effects via Web Audio — no audio files to load.
export type Sfx = "tap" | "tick" | "correct" | "wrong" | "countdown" | "go" | "win" | "lose" | "draw" | "found";

const KEY = "juvoraa-sfx";
let ctx: AudioContext | null = null;
// Global kill switch controlled by admins via settings/app.sfxEnabled.
let globalEnabled = true;

export function setSfxGloballyEnabled(on: boolean) {
  globalEnabled = on;
}

export function isSfxOn(): boolean {
  if (typeof window === "undefined") return false;
  return globalEnabled && localStorage.getItem(KEY) !== "off";
}

export function setSfxOn(on: boolean) {
  localStorage.setItem(KEY, on ? "on" : "off");
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.18) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

export function play(s: Sfx) {
  if (!isSfxOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    switch (s) {
      case "tap": tone(600, 0, 0.06, "triangle", 0.1); break;
      case "tick": tone(1000, 0, 0.05, "square", 0.05); break;
      case "countdown": tone(520, 0, 0.15, "triangle"); break;
      case "go": tone(880, 0, 0.3, "triangle", 0.22); break;
      case "correct": tone(660, 0, 0.1, "triangle"); tone(990, 0.08, 0.18, "triangle"); break;
      case "wrong": tone(220, 0, 0.18, "sawtooth", 0.1); tone(160, 0.12, 0.25, "sawtooth", 0.1); break;
      case "found": [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.15, "triangle")); break;
      case "win": [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.5 : 0.15, "triangle", 0.2)); break;
      case "draw": tone(523, 0, 0.2, "triangle"); tone(523, 0.22, 0.3, "triangle"); break;
      case "lose": [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.15, i === 3 ? 0.5 : 0.18, "triangle", 0.16)); break;
    }
  } catch { /* audio unavailable */ }
}
