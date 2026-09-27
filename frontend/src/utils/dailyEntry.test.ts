import { afterEach, describe, expect, it, vi } from "vitest";

import { getDailyEntryDate, getDefaultDailyVehicleId, readLastDailyVehicle, writeLastDailyVehicle } from "./dailyEntry";

afterEach(() => vi.unstubAllGlobals());

describe("daily entry defaults", () => {
  it("keeps the current or last selected vehicle when available", () => {
    expect(getDefaultDailyVehicleId([1, 2], "2", "1")).toBe("2");
    expect(getDefaultDailyVehicleId([1, 2], "", "2")).toBe("2");
  });

  it("uses the only vehicle and stays empty when selection is ambiguous", () => {
    expect(getDefaultDailyVehicleId([7], "", "")).toBe("7");
    expect(getDefaultDailyVehicleId([7, 8], "", "")).toBe("");
  });

  it("does not keep a vehicle that no longer belongs to the available list", () => {
    expect(getDefaultDailyVehicleId([1, 2], "9", "9")).toBe("");
    expect(getDefaultDailyVehicleId([], "9", "9")).toBe("");
    expect(getDefaultDailyVehicleId([7], "9", "9")).toBe("7");
  });

  it("uses the local current date without replacing an explicit date", () => {
    expect(getDailyEntryDate("", new Date(2026, 8, 26, 23, 59))).toBe("2026-09-26");
    expect(getDailyEntryDate("", new Date(2026, 8, 27, 0, 1))).toBe("2026-09-27");
    expect(getDailyEntryDate("2026-09-20", new Date(2026, 8, 27))).toBe("2026-09-20");
  });

  it("remembers only a vehicle ID separately for each account", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    writeLastDailyVehicle(10, "7");
    expect(readLastDailyVehicle(10)).toBe("7");
    expect(readLastDailyVehicle(20)).toBe("");
    writeLastDailyVehicle(20, "8");
    expect(readLastDailyVehicle(10)).toBe("7");
    expect(readLastDailyVehicle(20)).toBe("8");
    expect([...values.values()]).toEqual(["7", "8"]);
    writeLastDailyVehicle(10, "");
    expect(readLastDailyVehicle(10)).toBe("");
    expect(readLastDailyVehicle(20)).toBe("8");
  });

  it("ignores corrupted preferences and tolerates unavailable browser storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => '{"vehicle":7}' });
    expect(readLastDailyVehicle(10)).toBe("");
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("Storage blocked"); },
      setItem: () => { throw new Error("Storage full"); },
      removeItem: () => { throw new Error("Storage blocked"); },
    });
    expect(readLastDailyVehicle(10)).toBe("");
    expect(() => writeLastDailyVehicle(10, "7")).not.toThrow();
    expect(() => writeLastDailyVehicle(10, "")).not.toThrow();
  });
});
