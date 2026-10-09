"use client";

/** Confetti in the active theme's colours. Skipped entirely for people who prefer reduced motion. */
export async function celebrate(kind: "small" | "big" = "small") {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const confetti = (await import("canvas-confetti")).default;
  const css = getComputedStyle(document.documentElement);
  const colors = ["--pf-accent", "--pf-accent-2", "--pf-mastered", "--pf-developing", "--pf-accent-soft"]
    .map((v) => css.getPropertyValue(v).trim())
    .filter((c) => c.startsWith("#"));
  const base = { colors: colors.length ? colors : undefined, disableForReducedMotion: true, zIndex: 80 };
  if (kind === "small") {
    confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 38, origin: { y: 0.7 } });
    return;
  }
  const end = Date.now() + 900;
  (function frame() {
    confetti({ ...base, particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } });
    confetti({ ...base, particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ ...base, particleCount: 120, spread: 100, startVelocity: 45, origin: { y: 0.6 } });
}
