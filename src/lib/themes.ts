export interface Theme {
  id: string;
  name: string;
  blurb: string;
  /** Hue used to derive this theme's semantic color palette. */
  hue: number;
  /** Accent hue used for highlights. */
  accentHue: number;
  /** Palette chroma (0–0.3). */
  chroma: number;
}

export const THEMES: Theme[] = [
  { id: "purple", name: "Purple", blurb: "Violet & indigo", hue: 285, accentHue: 45, chroma: 0.2 },
  { id: "cloudy", name: "Cloudy", blurb: "Misty silver slate", hue: 240, accentHue: 220, chroma: 0.05 },
  { id: "reddy", name: "Reddy", blurb: "Red on charcoal", hue: 25, accentHue: 60, chroma: 0.2 },
  { id: "cyber", name: "Cyber", blurb: "Electric cyan", hue: 205, accentHue: 330, chroma: 0.15 },
  { id: "greeny", name: "Greeny", blurb: "Fresh emerald", hue: 155, accentHue: 95, chroma: 0.17 },
  { id: "bluey", name: "Bluey", blurb: "Royal navy", hue: 262, accentHue: 215, chroma: 0.19 },
  { id: "midnight", name: "Midnight", blurb: "Quiet monochrome", hue: 270, accentHue: 270, chroma: 0.01 },
  { id: "sunset", name: "Sunset", blurb: "Amber, coral, plum", hue: 42, accentHue: 350, chroma: 0.17 },
  { id: "aurora", name: "Aurora", blurb: "Teal & violet sky", hue: 180, accentHue: 300, chroma: 0.13 },
  { id: "gold", name: "Gold", blurb: "Black & trophy gold", hue: 85, accentHue: 60, chroma: 0.14 },
  { id: "rose", name: "Rose", blurb: "Dusty rose mauve", hue: 0, accentHue: 330, chroma: 0.15 },
  { id: "crimson", name: "Crimson", blurb: "Scarlet & wine", hue: 18, accentHue: 5, chroma: 0.23 },
  { id: "ocean", name: "Ocean", blurb: "Turquoise depths", hue: 215, accentHue: 185, chroma: 0.13 },
  { id: "forest", name: "Forest", blurb: "Moss & earth", hue: 135, accentHue: 80, chroma: 0.11 },
  { id: "obsidian", name: "Obsidian", blurb: "Graphite glass", hue: 250, accentHue: 80, chroma: 0.02 },
  { id: "lavender", name: "Lavender", blurb: "Soft lilac haze", hue: 300, accentHue: 260, chroma: 0.12 },
  { id: "mint", name: "Mint", blurb: "Cool fresh mint", hue: 170, accentHue: 140, chroma: 0.12 },
  { id: "tangerine", name: "Tangerine", blurb: "Bright citrus", hue: 55, accentHue: 25, chroma: 0.19 },
  { id: "neon", name: "Neon", blurb: "Lime & magenta glow", hue: 135, accentHue: 320, chroma: 0.25 },
  { id: "sapphire", name: "Sapphire", blurb: "Deep jewel blue", hue: 250, accentHue: 200, chroma: 0.2 },
  { id: "coffee", name: "Coffee", blurb: "Mocha & cream", hue: 55, accentHue: 70, chroma: 0.07 },
  { id: "bubblegum", name: "Bubblegum", blurb: "Pink & sky pop", hue: 345, accentHue: 220, chroma: 0.18 },
  { id: "volcano", name: "Volcano", blurb: "Lava orange", hue: 35, accentHue: 10, chroma: 0.22 },
  { id: "arctic", name: "Arctic", blurb: "Icy pale blue", hue: 220, accentHue: 195, chroma: 0.08 },
  { id: "royal", name: "Royal", blurb: "Purple & gold crown", hue: 295, accentHue: 85, chroma: 0.17 },
  { id: "christmas", name: "Christmas", blurb: "🎄 Pine, berry red & snow", hue: 150, accentHue: 25, chroma: 0.13 },
  { id: "newmonth", name: "New Month", blurb: "🎉 Fresh start confetti", hue: 300, accentHue: 85, chroma: 0.2 },
  { id: "muslim", name: "Ramadan", blurb: "🌙 Crescent, emerald & gold", hue: 165, accentHue: 85, chroma: 0.12 },
];

export type ThemeId = string;
export type Appearance = "dark" | "light";

export function normalizeCustomThemes(value: unknown): Theme[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set(THEMES.map((theme) => theme.id));
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const theme = item as Partial<Theme>;
    if (typeof theme.id !== "string" || !/^[a-z0-9-]{1,32}$/.test(theme.id) ||
      typeof theme.name !== "string" || !theme.name.trim() ||
      typeof theme.blurb !== "string" ||
      !Number.isFinite(theme.hue) || !Number.isFinite(theme.accentHue) || !Number.isFinite(theme.chroma) ||
      seen.has(theme.id)) return [];
    seen.add(theme.id);
    return [{
      id: theme.id,
      name: theme.name.trim().slice(0, 40),
      blurb: theme.blurb.trim().slice(0, 80),
      hue: Math.round((theme.hue! % 360 + 360) % 360),
      accentHue: Math.round((theme.accentHue! % 360 + 360) % 360),
      chroma: Math.min(0.3, Math.max(0, theme.chroma!)),
    }];
  });
}

export function applyTheme(theme: string, mode: Appearance, customThemes: Theme[] = []) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  const custom = customThemes.find((item) => item.id === theme);
  for (const property of ["--h", "--ah", "--c", "--sc", "--ac", "--pl-d", "--pl-l", "--sh", "--on-d"] as const) {
    root.style.removeProperty(property);
  }
  if (custom) {
    const chroma = Math.max(0, Math.min(0.3, custom.chroma));
    root.style.setProperty("--h", String(custom.hue));
    root.style.setProperty("--ah", String(custom.accentHue));
    root.style.setProperty("--c", String(chroma));
    root.style.setProperty("--sc", String(Math.max(0.008, chroma * 0.18)));
    root.style.setProperty("--ac", String(Math.max(0.05, chroma * 0.85)));
    root.style.setProperty("--pl-d", chroma < 0.08 ? "0.82" : "0.66");
    root.style.setProperty("--pl-l", chroma < 0.08 ? "0.42" : "0.53");
  }
  try {
    localStorage.setItem("fb-theme", JSON.stringify({ theme, mode }));
  } catch {
    /* ignore */
  }
}

export function readLocalTheme(): { theme: string; mode: Appearance } | null {
  try {
    const raw = localStorage.getItem("fb-theme");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Inline script for <head> so the saved theme paints before React hydrates.
export const THEME_BOOT_SCRIPT = `try{var t=JSON.parse(localStorage.getItem('fb-theme')||'null');if(t){document.documentElement.dataset.theme=t.theme;document.documentElement.dataset.mode=t.mode}}catch(e){}`;
