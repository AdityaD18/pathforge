import { describe, expect, it } from "vitest";

import { heatColor, masteryState, minutesLabel, pct } from "./format";

const lightness = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("masteryState", () => {
  it("uses the same thresholds as the backend roadmap (0.4 developing, 0.7 mastered)", () => {
    expect(masteryState(null)).toBe("not_assessed");
    expect(masteryState(0.39)).toBe("beginning");
    expect(masteryState(0.4)).toBe("developing");
    expect(masteryState(0.69)).toBe("developing");
    expect(masteryState(0.7)).toBe("mastered");
  });
});

describe("heatColor", () => {
  it("is a single-hue ramp whose lightness increases monotonically", () => {
    const values = [0, 0.25, 0.5, 0.75, 1].map((v) => lightness(heatColor(v)));
    expect([...values].sort((a, b) => a - b)).toEqual(values);
    expect(new Set(values).size).toBe(values.length);
  });
  it("clamps out-of-range values and renders missing data as transparent", () => {
    expect(heatColor(2)).toBe(heatColor(1));
    expect(heatColor(-1)).toBe(heatColor(0));
    expect(heatColor(null)).toBe("transparent");
  });
});

describe("labels", () => {
  it("formats durations and percentages", () => {
    expect(minutesLabel(45)).toBe("45 min");
    expect(minutesLabel(90)).toBe("1.5 h");
    expect(minutesLabel(600)).toBe("10 h");
    expect(pct(0.734)).toBe("73%");
    expect(pct(null)).toBe("—");
  });
});
