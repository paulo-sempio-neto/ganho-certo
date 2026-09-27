import { describe, expect, it } from "vitest";

import {
  formatDistance,
  formatHours,
  formatPercent,
  formatWorkTime,
  getImportFieldLabel,
  getProgressWidth,
} from "./formatters";

describe("formatters", () => {
  it("formats basic distance and time values", () => {
    expect(formatDistance("12.50")).toBe("12,50");
    expect(formatWorkTime(125)).toBe("2h 05min");
  });

  it("is null and invalid-number safe", () => {
    expect(formatPercent(null)).toBe("\u2014");
    expect(formatHours(null)).toBe("\u2014");
    expect(getProgressWidth(null)).toBe("0%");
    expect(getProgressWidth("NaN")).toBe("0%");
    expect(getProgressWidth("Infinity")).toBe("0%");
  });

  it("preserves Portuguese accents in import labels", () => {
    expect(getImportFieldLabel("header")).toBe("Cabe\u00e7alho");
  });

  it("clamps progress width", () => {
    expect(getProgressWidth("-1")).toBe("0%");
    expect(getProgressWidth("101")).toBe("100%");
    expect(getProgressWidth("55.5")).toBe("55.5%");
  });
});
