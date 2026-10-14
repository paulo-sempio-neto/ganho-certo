import { describe, expect, it } from "vitest";

import { wrap } from "./wrap";

describe("wrap", () => {
  it("keeps values inside the range unchanged", () => {
    expect(wrap(0, 50, 12)).toBe(12);
  });

  it("wraps values past either end back into the range", () => {
    expect(wrap(0, 50, 62)).toBe(12);
    expect(wrap(0, 50, -8)).toBe(42);
    expect(wrap(-50, 0, 10)).toBe(-40);
  });
});
