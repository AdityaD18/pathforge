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
  const h = min / 60;
  return h < 10 ? `${h.toFixed(h % 1 ? 1 : 0)} h` : `${Math.round(h)} h`;
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

export const STATE_COLOR: Record<MasteryState, string> = {
  not_assessed: "#5d6a92", beginning: "#ff7a8a", developing: "#f2c66d", mastered: "#5ed3a8",
};

export const STATUS_LABEL: Record<StepStatus, string> = {
  ready: "Ready to start", in_progress: "In progress", locked: "Locked", mastered: "Mastered",
};

/**
 * Single-hue sequential scale (dark → light blue) for heatmap cells, 0 = weak, 1 = strong.
 * Lightness increases monotonically so the order survives colour-vision deficiency and greyscale.
 */
export function heatColor(v: number | null): string {
  if (v === null) return "transparent";
  const lo = [28, 43, 90];
  const hi = [168, 200, 255];
  const t = Math.min(Math.max(v, 0), 1);
  const c = lo.map((a, k) => Math.round(a + (hi[k] - a) * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/** Readable ink for text drawn on a heatColor cell. */
export const heatInk = (v: number | null) => (v !== null && v > 0.55 ? "#08122e" : "#e7ecfa");
