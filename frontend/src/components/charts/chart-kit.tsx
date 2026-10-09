"use client";

import type { CSSProperties } from "react";

import { alpha, C } from "@/lib/format";

// Shared, recessive chart chrome: thin muted axes, faint grid, text in ink tokens (never series colour).
export const AXIS = { stroke: C.line, tick: { fill: C.mist, fontSize: 13 }, tickLine: false } as const;
export const GRID = { stroke: C.lineSoft, strokeDasharray: "0", vertical: false } as const;
export const TOOLTIP_STYLE: CSSProperties = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 14, color: C.ink,
  boxShadow: "0 10px 30px rgb(0 0 0 / 0.25)",
};
export const TOOLTIP_LABEL: CSSProperties = { color: C.mist, marginBottom: 4 };
export const SERIES = C.accent; // the main data colour; identity is carried by titles, not hue
export const SERIES_2 = C.accent2;
export const CURSOR = { fill: alpha(C.accentSoft, 8) };
/** Distinct-but-harmonious colours for multi-series charts, all derived from the theme. */
export const PALETTE = [C.accent, C.accent2, C.mastered, C.developing, C.beginning, C.accentSoft, C.accent2Soft];
