"use client";

import type { CSSProperties } from "react";

// Shared, recessive chart chrome: thin muted axes, faint grid, text in ink tokens (never series colour).
export const AXIS = { stroke: "#22305c", tick: { fill: "#8a97bd", fontSize: 11 }, tickLine: false } as const;
export const GRID = { stroke: "#1a2750", strokeDasharray: "0", vertical: false } as const;
export const TOOLTIP_STYLE: CSSProperties = {
  background: "#101a3a", border: "1px solid #22305c", borderRadius: 8, fontSize: 12, color: "#e7ecfa", boxShadow: "0 8px 24px rgb(0 0 0 / 0.35)",
};
export const TOOLTIP_LABEL: CSSProperties = { color: "#8a97bd", marginBottom: 4 };
export const SERIES = "#4c8dff"; // the single data colour; identity is carried by titles, not hue
export const CURSOR = { fill: "rgb(143 182 255 / 0.06)" };
