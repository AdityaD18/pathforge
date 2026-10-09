import { describe, expect, it } from "vitest";

import { customAccentVars, THEME_BOOT_SCRIPT, themeCss, THEMES, type ThemeTokens } from "./themes";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("theme palettes", () => {
  it("are complete, well-formed and uniquely named", () => {
    const keys = Object.keys(THEMES[0].tokens).sort();
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const t of THEMES) {
      expect(Object.keys(t.tokens).sort()).toEqual(keys);
      for (const v of Object.values(t.tokens)) expect(v).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.id).toMatch(/^[a-z][a-z0-9-]{1,31}$/);
    }
  });

  it.each(THEMES.map((t) => [t.id, t.tokens] as const))("%s keeps text readable (WCAG AA)", (_id, k: ThemeTokens) => {
    for (const surface of [k.bg, k.panel, k.panel2]) {
      expect(contrast(k.ink, surface)).toBeGreaterThanOrEqual(7); // body text: AAA
      expect(contrast(k.mist, surface)).toBeGreaterThanOrEqual(4.5); // secondary text: AA
      expect(contrast(k.haze, surface)).toBeGreaterThanOrEqual(3); // hints at 14px+: AA large / UI
      expect(contrast(k.accentSoft, surface)).toBeGreaterThanOrEqual(4.5); // links
    }
    expect(contrast(k.onAccent, k.accent)).toBeGreaterThanOrEqual(4.5); // primary button label
    expect(contrast(k.heatInkLo, k.heatLo)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(k.heatInkHi, k.heatHi)).toBeGreaterThanOrEqual(4.5);
    for (const state of [k.mastered, k.developing, k.beginning]) expect(contrast(state, k.panel)).toBeGreaterThanOrEqual(3);
  });

  it("orders heat ends so lightness changes monotonically in the same direction as ink flips", () => {
    for (const t of THEMES) {
      const k = t.tokens;
      const lightEnds = luminance(k.heatHi) > luminance(k.heatLo);
      // Dark-on-light at the high end for dark themes, light-on-dark for light themes.
      expect(luminance(k.heatInkHi) < luminance(k.heatHi)).toBe(lightEnds);
    }
  });

  it("emits a CSS block for every theme plus system and custom", () => {
    const css = themeCss();
    for (const t of THEMES) expect(css).toContain(`[data-theme="${t.id}"]{`);
    expect(css).toContain('[data-theme="system"]');
    expect(css).toContain('[data-theme="custom"]');
    expect(css).toContain("prefers-color-scheme: light");
    // Same specificity as :root, so every named theme must be declared after the default block.
    const rootAt = css.indexOf(":root");
    for (const t of THEMES) expect(css.indexOf(`[data-theme="${t.id}"]{`)).toBeGreaterThan(rootAt);
  });
});

describe("custom accent", () => {
  it("boot script derives the same variables as customAccentVars", () => {
    const set: Record<string, string> = {};
    const html = { setAttribute: () => {}, style: { setProperty: (k: string, v: string) => (set[k] = v) } };
    const store = { getItem: () => JSON.stringify({ theme: "custom", accent: "#22aa88" }) };
    new Function("document", "localStorage", THEME_BOOT_SCRIPT)({ documentElement: html }, store);
    expect(set).toEqual(customAccentVars("#22aa88"));
  });

  it("picks a readable label colour for light and dark accents", () => {
    expect(customAccentVars("#ffe066")["--pf-custom-on-accent"]).toBe("#0b0b14");
    expect(customAccentVars("#1e3a8a")["--pf-custom-on-accent"]).toBe("#ffffff");
  });
});
