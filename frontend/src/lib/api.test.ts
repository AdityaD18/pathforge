import { describe, expect, it } from "vitest";

import { qs } from "./api";

describe("qs", () => {
  it("repeats array params and drops empty values", () => {
    expect(qs({ format: ["video", "book"], level: [], topic: null, limit: 12 })).toBe("?format=video&format=book&limit=12");
    expect(qs({ topic: undefined })).toBe("");
  });
});
