import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Format, Level, MasteryState, StepStatus } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;

export const fixed = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined ? "—" : v.toFixed(digits);

export function minutesLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.round((min / 60) * 10) / 10;
  return h < 10 ? `${Number.isInteger(h) ? h : h.toFixed(1)} h` : `${Math.round(h)} h`;
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const LEVEL_LABEL: Record<Level, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export const FORMAT_LABEL: Record<Format, string> = {
  video: "Video", article: "Article", course: "Course", interactive: "Interactive", book: "Book", documentation: "Docs",
};

export function masteryState(score: number | null | undefined): MasteryState {
  if (score === null || score === undefined) return "not_assessed";
  if (score >= 0.7) return "mastered";
  if (score >= 0.4) return "developing";
  return "beginning";
}

export const STATE_LABEL: Record<MasteryState, string> = {
  not_assessed: "Not assessed", beginning: "Beginning", developing: "Developing", mastered: "Mastered",
};

/** Theme tokens as CSS values, for inline styles and SVG/Recharts props (which accept var()). */
export const C = {
  bg: "var(--pf-bg)", deep: "var(--pf-deep)", panel: "var(--pf-panel)", panel2: "var(--pf-panel-2)",
  line: "var(--pf-line)", lineSoft: "var(--pf-line-soft)", ink: "var(--pf-ink)", mist: "var(--pf-mist)", haze: "var(--pf-haze)",
  accent: "var(--pf-accent)", accentSoft: "var(--pf-accent-soft)", accent2: "var(--pf-accent-2)", accent2Soft: "var(--pf-accent-2-soft)",
  onAccent: "var(--pf-on-accent)", mastered: "var(--pf-mastered)", developing: "var(--pf-developing)",
  beginning: "var(--pf-beginning)", locked: "var(--pf-locked)",
} as const;

/** `color` at `percent`% opacity, for any token. */
export const alpha = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

export const STATE_COLOR: Record<MasteryState, string> = {
  not_assessed: C.haze, beginning: C.beginning, developing: C.developing, mastered: C.mastered,
};

export const STATUS_LABEL: Record<StepStatus, string> = {
  ready: "Ready to start", in_progress: "In progress", locked: "Locked", mastered: "Mastered",
};

/**
 * Single-hue sequential scale for heatmap cells, 0 = weak, 1 = strong. Each theme defines the two ends
 * (--pf-heat-lo/hi) so lightness changes monotonically and the order survives colour-vision deficiency.
 */
export function heatColor(v: number | null): string {
  if (v === null) return "transparent";
  const t = Math.round(Math.min(Math.max(v, 0), 1) * 100);
  return `color-mix(in oklab, var(--pf-heat-hi) ${t}%, var(--pf-heat-lo))`;
}

/** Readable ink for text drawn on a heatColor cell. */
export const heatInk = (v: number | null) => (v !== null && v > 0.55 ? "var(--pf-heat-ink-hi)" : "var(--pf-heat-ink-lo)");
