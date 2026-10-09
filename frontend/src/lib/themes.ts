/**
 * Appearance themes. This file is the single source of truth: `themeCss()` turns every palette into a
 * `[data-theme="…"]` block (rendered into <head> by the root layout), the picker reads names and swatches
 * from here, and the backend's `Theme` literal in app/schemas.py lists the same ids.
 *
 * Every colour in the app resolves to one of these tokens, so a new theme only needs a palette here.
 */

export type ThemeTokens = {
  bg: string; deep: string; panel: string; panel2: string; line: string; lineSoft: string;
  ink: string; mist: string; haze: string;
  accent: string; accentSoft: string; accent2: string; accent2Soft: string; onAccent: string;
  mastered: string; developing: string; beginning: string; locked: string;
  heatLo: string; heatHi: string; heatInkLo: string; heatInkHi: string;
};

export type ThemeGroup = "dark" | "light" | "special";
export type ThemeDef = { id: string; name: string; mood: string; scheme: "dark" | "light"; group: ThemeGroup; tokens: ThemeTokens };

const STATES_DARK = { mastered: "#5ed3a8", developing: "#f2c66d", beginning: "#ff7a8a" };

export const THEMES: ThemeDef[] = [
  {
    id: "midnight", name: "Midnight", mood: "Navy and electric blue", scheme: "dark", group: "dark",
    tokens: {
      bg: "#0a1128", deep: "#070c1d", panel: "#101a3a", panel2: "#142048", line: "#22305c", lineSoft: "#1a2750",
      ink: "#e7ecfa", mist: "#93a0c5", haze: "#6c79a2",
      accent: "#4c8dff", accentSoft: "#8fb6ff", accent2: "#8b7bff", accent2Soft: "#b9afff", onAccent: "#06102a",
      ...STATES_DARK, locked: "#3a4673", heatLo: "#1c2b5a", heatHi: "#a8c8ff", heatInkLo: "#e7ecfa", heatInkHi: "#08122e",
    },
  },
  {
    id: "aurora", name: "Aurora", mood: "Northern lights", scheme: "dark", group: "dark",
    tokens: {
      bg: "#061518", deep: "#041012", panel: "#0c2226", panel2: "#102c31", line: "#1d4148", lineSoft: "#163339",
      ink: "#e3f6f2", mist: "#94bdb6", haze: "#68948e",
      accent: "#2dd4bf", accentSoft: "#8ef0e2", accent2: "#a78bfa", accent2Soft: "#cfc0ff", onAccent: "#04201c",
      mastered: "#4ade80", developing: "#fbbf24", beginning: "#fb7185", locked: "#24464c",
      heatLo: "#0f3a3c", heatHi: "#99f6e4", heatInkLo: "#e3f6f2", heatInkHi: "#04201c",
    },
  },
  {
    id: "nebula", name: "Nebula", mood: "Deep space purple", scheme: "dark", group: "dark",
    tokens: {
      bg: "#0f0a1f", deep: "#0a0616", panel: "#18112e", panel2: "#1f1640", line: "#33275c", lineSoft: "#261d48",
      ink: "#efeaff", mist: "#ada0d4", haze: "#7e71a8",
      accent: "#c084fc", accentSoft: "#e2c2ff", accent2: "#f472b6", accent2Soft: "#fbb6d9", onAccent: "#1c0933",
      mastered: "#5eead4", developing: "#fcd34d", beginning: "#fb7185", locked: "#3a2f63",
      heatLo: "#2a1d4d", heatHi: "#e9d5ff", heatInkLo: "#efeaff", heatInkHi: "#1c0933",
    },
  },
  {
    id: "ocean", name: "Ocean", mood: "Calm deep water", scheme: "dark", group: "dark",
    tokens: {
      bg: "#04141f", deep: "#020d15", panel: "#0a2030", panel2: "#0d2a3e", line: "#1a4560", lineSoft: "#14364c",
      ink: "#e2f1fb", mist: "#92b8d1", haze: "#648fab",
      accent: "#38bdf8", accentSoft: "#a5e0fc", accent2: "#818cf8", accent2Soft: "#c7d2fe", onAccent: "#032030",
      mastered: "#34d399", developing: "#fbbf24", beginning: "#f87171", locked: "#1f4057",
      heatLo: "#0e3550", heatHi: "#bae6fd", heatInkLo: "#e2f1fb", heatInkHi: "#032030",
    },
  },
  {
    id: "ember", name: "Ember", mood: "Warm and focused", scheme: "dark", group: "dark",
    tokens: {
      bg: "#150e0b", deep: "#0e0907", panel: "#22170f", panel2: "#2b1d14", line: "#4a3222", lineSoft: "#3a281b",
      ink: "#f7ede6", mist: "#c7ac9b", haze: "#987e6e",
      accent: "#fb923c", accentSoft: "#fdc59a", accent2: "#f43f5e", accent2Soft: "#fda4b4", onAccent: "#2a1203",
      mastered: "#4ade80", developing: "#facc15", beginning: "#f87171", locked: "#4a3426",
      heatLo: "#3b2416", heatHi: "#fed7aa", heatInkLo: "#f7ede6", heatInkHi: "#2a1203",
    },
  },
  {
    id: "forest", name: "Forest", mood: "Calm green", scheme: "dark", group: "dark",
    tokens: {
      bg: "#0b130e", deep: "#070d09", panel: "#122018", panel2: "#17291e", line: "#284733", lineSoft: "#1f3828",
      ink: "#e6f2ea", mist: "#9fbdaa", haze: "#71907c",
      accent: "#4ade80", accentSoft: "#a7f3c4", accent2: "#facc15", accent2Soft: "#fde68a", onAccent: "#052e14",
      mastered: "#2dd4bf", developing: "#fbbf24", beginning: "#fb7185", locked: "#2a4434",
      heatLo: "#173a24", heatHi: "#bbf7d0", heatInkLo: "#e6f2ea", heatInkHi: "#052e14",
    },
  },
  {
    id: "cyberpunk", name: "Cyberpunk", mood: "Neon on black", scheme: "dark", group: "dark",
    tokens: {
      bg: "#09090f", deep: "#050508", panel: "#13131d", panel2: "#191926", line: "#2c2c44", lineSoft: "#222235",
      ink: "#f2f2f7", mist: "#aaaac4", haze: "#7a7a9e",
      accent: "#ff2e93", accentSoft: "#ff8fc4", accent2: "#00f5d4", accent2Soft: "#8ffcec", onAccent: "#2a0015",
      mastered: "#39ff88", developing: "#ffe14d", beginning: "#ff5470", locked: "#2e2e48",
      heatLo: "#2a1030", heatHi: "#ff9ad0", heatInkLo: "#f2f2f7", heatInkHi: "#2a0015",
    },
  },
  {
    id: "slate", name: "Slate", mood: "Quiet neutral grey", scheme: "dark", group: "dark",
    tokens: {
      bg: "#111316", deep: "#0b0c0e", panel: "#181b1f", panel2: "#1e2227", line: "#2f343b", lineSoft: "#262a30",
      ink: "#eceef1", mist: "#a5abb5", haze: "#787f8a",
      accent: "#60a5fa", accentSoft: "#bfdbfe", accent2: "#a78bfa", accent2Soft: "#ddd6fe", onAccent: "#0a1a33",
      mastered: "#4ade80", developing: "#fbbf24", beginning: "#f87171", locked: "#343a42",
      heatLo: "#1f2a3a", heatHi: "#bfdbfe", heatInkLo: "#eceef1", heatInkHi: "#0a1a33",
    },
  },
  {
    id: "mono", name: "Mono", mood: "Pure black and white", scheme: "dark", group: "dark",
    tokens: {
      bg: "#0a0a0a", deep: "#050505", panel: "#141414", panel2: "#1a1a1a", line: "#2e2e2e", lineSoft: "#222222",
      ink: "#fafafa", mist: "#a8a8a8", haze: "#7a7a7a",
      accent: "#fafafa", accentSoft: "#d4d4d4", accent2: "#9a9a9a", accent2Soft: "#d4d4d4", onAccent: "#0a0a0a",
      mastered: "#86efac", developing: "#fde68a", beginning: "#fca5a5", locked: "#333333",
      heatLo: "#262626", heatHi: "#f5f5f5", heatInkLo: "#fafafa", heatInkHi: "#0a0a0a",
    },
  },
  {
    id: "paper", name: "Paper", mood: "Warm cream, bookish", scheme: "light", group: "light",
    tokens: {
      bg: "#faf6ee", deep: "#f2ecdf", panel: "#fffdf8", panel2: "#f6f0e4", line: "#e0d5c2", lineSoft: "#ebe3d4",
      ink: "#2b2620", mist: "#665c50", haze: "#857a6d",
      accent: "#b4532a", accentSoft: "#8f3d1a", accent2: "#2f6f6a", accent2Soft: "#24524e", onAccent: "#fffaf3",
      mastered: "#2f855a", developing: "#b7791f", beginning: "#c53030", locked: "#cbbfac",
      heatLo: "#f3e7d3", heatHi: "#8f3d1a", heatInkLo: "#2b2620", heatInkHi: "#fffaf3",
    },
  },
  {
    id: "sky", name: "Sky", mood: "Clean and bright", scheme: "light", group: "light",
    tokens: {
      bg: "#f5f8ff", deep: "#eaf0fb", panel: "#ffffff", panel2: "#f0f4fc", line: "#d3dcee", lineSoft: "#e2e8f5",
      ink: "#111827", mist: "#475164", haze: "#6b7588",
      accent: "#2563eb", accentSoft: "#1d4ed8", accent2: "#7c3aed", accent2Soft: "#6d28d9", onAccent: "#ffffff",
      mastered: "#059669", developing: "#d97706", beginning: "#e11d48", locked: "#c5cede",
      heatLo: "#e0e9fb", heatHi: "#1e40af", heatInkLo: "#111827", heatInkHi: "#ffffff",
    },
  },
  {
    id: "sakura", name: "Sakura", mood: "Soft pink", scheme: "light", group: "light",
    tokens: {
      bg: "#fff5f7", deep: "#fbe9ee", panel: "#ffffff", panel2: "#fdf0f3", line: "#efd0d9", lineSoft: "#f6e0e7",
      ink: "#3a1f2b", mist: "#765262", haze: "#987483",
      accent: "#db2777", accentSoft: "#be185d", accent2: "#7c3aed", accent2Soft: "#6d28d9", onAccent: "#ffffff",
      mastered: "#059669", developing: "#c26a06", beginning: "#dc2626", locked: "#e6c9d2",
      heatLo: "#fde4ec", heatHi: "#9d174d", heatInkLo: "#3a1f2b", heatInkHi: "#ffffff",
    },
  },
  {
    id: "mint", name: "Mint", mood: "Fresh and light", scheme: "light", group: "light",
    tokens: {
      bg: "#f2fbf7", deep: "#e3f5ec", panel: "#ffffff", panel2: "#ecf8f2", line: "#cce7da", lineSoft: "#dcf1e6",
      ink: "#10261d", mist: "#4a675a", haze: "#6f8c7f",
      accent: "#047857", accentSoft: "#065f46", accent2: "#0369a1", accent2Soft: "#075985", onAccent: "#ffffff",
      mastered: "#15803d", developing: "#b45309", beginning: "#dc2626", locked: "#c6e0d3",
      heatLo: "#dcf5e9", heatHi: "#065f46", heatInkLo: "#10261d", heatInkHi: "#ffffff",
    },
  },
  {
    id: "sunset", name: "Sunset", mood: "Peach and coral", scheme: "light", group: "light",
    tokens: {
      bg: "#fff7ed", deep: "#ffedd5", panel: "#ffffff", panel2: "#fff3e6", line: "#f2d4b5", lineSoft: "#f9e3cc",
      ink: "#2d1a0e", mist: "#74533d", haze: "#987863",
      accent: "#c2410c", accentSoft: "#9a3412", accent2: "#db2777", accent2Soft: "#be185d", onAccent: "#ffffff",
      mastered: "#15803d", developing: "#b45309", beginning: "#dc2626", locked: "#ecd3bb",
      heatLo: "#ffedd5", heatHi: "#9a3412", heatInkLo: "#2d1a0e", heatInkHi: "#ffffff",
    },
  },
  {
    id: "contrast", name: "High contrast", mood: "Accessibility first", scheme: "dark", group: "special",
    tokens: {
      bg: "#000000", deep: "#000000", panel: "#0a0a0a", panel2: "#141414", line: "#a3a3a3", lineSoft: "#6b6b6b",
      ink: "#ffffff", mist: "#ebebeb", haze: "#cfcfcf",
      accent: "#ffd400", accentSoft: "#ffe566", accent2: "#00e5ff", accent2Soft: "#80f2ff", onAccent: "#000000",
      mastered: "#3dff8a", developing: "#ffb020", beginning: "#ff6b6b", locked: "#6b6b6b",
      heatLo: "#1a1a1a", heatHi: "#ffd400", heatInkLo: "#ffffff", heatInkHi: "#000000",
    },
  },
];

export const THEME_IDS = ["system", ...THEMES.map((t) => t.id), "custom"] as const;
export type ThemeId = string;
export const DEFAULT_ACCENT = "#ff6b6b";
export const SYSTEM_DARK = "midnight";
export const SYSTEM_LIGHT = "sky";

export const themeById = (id: string) => THEMES.find((t) => t.id === id);

const VAR: Record<keyof ThemeTokens, string> = {
  bg: "--pf-bg", deep: "--pf-deep", panel: "--pf-panel", panel2: "--pf-panel-2", line: "--pf-line", lineSoft: "--pf-line-soft",
  ink: "--pf-ink", mist: "--pf-mist", haze: "--pf-haze",
  accent: "--pf-accent", accentSoft: "--pf-accent-soft", accent2: "--pf-accent-2", accent2Soft: "--pf-accent-2-soft", onAccent: "--pf-on-accent",
  mastered: "--pf-mastered", developing: "--pf-developing", beginning: "--pf-beginning", locked: "--pf-locked",
  heatLo: "--pf-heat-lo", heatHi: "--pf-heat-hi", heatInkLo: "--pf-heat-ink-lo", heatInkHi: "--pf-heat-ink-hi",
};

const block = (t: ThemeTokens) => Object.entries(t).map(([k, v]) => `${VAR[k as keyof ThemeTokens]}:${v}`).join(";");

/** CSS for every theme. `system` resolves through prefers-color-scheme; `custom` reads accent vars set at runtime. */
export function themeCss(): string {
  const dark = themeById(SYSTEM_DARK)!.tokens;
  const light = themeById(SYSTEM_LIGHT)!.tokens;
  // Defaults first: :root has the same specificity as [data-theme=…], so the named themes must come after it.
  const out: string[] = [`:root,[data-theme="system"]{${block(dark)};color-scheme:dark}`,
    `@media (prefers-color-scheme: light){[data-theme="system"]{${block(light)};color-scheme:light}}`];
  for (const t of THEMES) out.push(`[data-theme="${t.id}"]{${block(t.tokens)};color-scheme:${t.scheme}}`);
  // Custom: the Midnight base with the learner's accent (vars --pf-custom-* are written by the theme script).
  out.push(`[data-theme="custom"]{${block(dark)};color-scheme:dark;--pf-accent:var(--pf-custom-accent,${DEFAULT_ACCENT});` +
    `--pf-accent-soft:var(--pf-custom-accent-soft);--pf-accent-2:var(--pf-custom-accent-2);--pf-accent-2-soft:var(--pf-custom-accent-2-soft);` +
    `--pf-on-accent:var(--pf-custom-on-accent);--pf-heat-hi:var(--pf-custom-accent-soft)}`);
  return out.join("\n");
}

// ---- custom accent maths (also inlined, in plain JS, in THEME_BOOT_SCRIPT below) -----------------------
function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;

export function customAccentVars(hex: string): Record<string, string> {
  const [h, s, l] = hexToHsl(hex);
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return {
    "--pf-custom-accent": hex,
    "--pf-custom-accent-soft": hsl(h, Math.min(s, 90), Math.min(l + 22, 88)),
    "--pf-custom-accent-2": hsl(h + 42, Math.max(s, 55), Math.max(Math.min(l, 68), 55)),
    "--pf-custom-accent-2-soft": hsl(h + 42, Math.min(s, 90), Math.min(l + 24, 88)),
    "--pf-custom-on-accent": lum > 150 ? "#0b0b14" : "#ffffff",
  };
}

export const THEME_STORAGE_KEY = "pf-theme";

/**
 * Runs before first paint (inlined in <head>): applies the saved theme so there is no flash of the default.
 * Kept dependency-free and tiny; mirrors customAccentVars().
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${THEME_STORAGE_KEY}")||"{}");var t=s.theme||"system";var e=document.documentElement;e.setAttribute("data-theme",t);if(t==="custom"&&/^#[0-9a-f]{6}$/i.test(s.accent||"")){var x=s.accent,n=parseInt(x.slice(1),16),r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255,M=Math.max(r,g,b),m=Math.min(r,g,b),l=(M+m)/2,h=0,S=0;if(M!==m){var d=M-m;S=l>.5?d/(2-M-m):d/(M+m);h=M===r?(g-b)/d+(g<b?6:0):M===g?(b-r)/d+2:(r-g)/d+4}h*=60;S*=100;l*=100;var f=function(a,b,c){return"hsl("+Math.round(((a%360)+360)%360)+" "+Math.round(b)+"% "+Math.round(c)+"%)"};var L=.2126*(n>>16&255)+.7152*(n>>8&255)+.0722*(n&255);var p=e.style;p.setProperty("--pf-custom-accent",x);p.setProperty("--pf-custom-accent-soft",f(h,Math.min(S,90),Math.min(l+22,88)));p.setProperty("--pf-custom-accent-2",f(h+42,Math.max(S,55),Math.max(Math.min(l,68),55)));p.setProperty("--pf-custom-accent-2-soft",f(h+42,Math.min(S,90),Math.min(l+24,88)));p.setProperty("--pf-custom-on-accent",L>150?"#0b0b14":"#ffffff")}}catch(_){}})();`;
