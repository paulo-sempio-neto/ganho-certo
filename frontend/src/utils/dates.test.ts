import { describe, expect, it } from "vitest";

import {
  getDefaultHistoryGrouping,
  getInclusiveDateCount,
  parseDateInput,
  toDateInputValue,
} from "./dates";

describe("date utilities", () => {
  it("formats date input values from local date parts without UTC day shift", () => {
    const lateLocalDate = new Date(2026, 8, 24, 23, 30, 0);

    expect(toDateInputValue(lateLocalDate)).toBe("2026-09-24");
  });

  it("parses date input values as local dates", () => {
    const parsed = parseDateInput("2026-09-24");

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(24);
  });

  it("calculates inclusive ranges and default history grouping", () => {
    expect(getInclusiveDateCount("2026-09-01", "2026-09-01")).toBe(1);
    expect(getDefaultHistoryGrouping("2026-09-01", "2026-09-14")).toBe("daily");
    expect(getDefaultHistoryGrouping("2026-09-01", "2026-10-15")).toBe("weekly");
    expect(getDefaultHistoryGrouping("2026-01-01", "2026-09-24")).toBe("monthly");
  });
});
