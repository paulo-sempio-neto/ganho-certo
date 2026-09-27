import { describe, expect, it } from "vitest";

import { formatDurationInput, parseDurationToMinutes } from "./duration";

describe("duration helpers", () => {
  it("converts simple duration formats to internal minutes", () => {
    expect(parseDurationToMinutes("8:30")).toBe(510);
    expect(parseDurationToMinutes("8h30")).toBe(510);
    expect(parseDurationToMinutes("8h30m")).toBe(510);
    expect(parseDurationToMinutes("8")).toBe(480);
    expect(parseDurationToMinutes(" 8 H 30 m ")).toBe(510);
    expect(parseDurationToMinutes("8h")).toBe(480);
    expect(parseDurationToMinutes("0:45")).toBe(45);
  });

  it("formats backend minutes for editable duration input", () => {
    expect(formatDurationInput(510)).toBe("8:30");
    expect(formatDurationInput(45)).toBe("0:45");
  });

  it("keeps missing and invalid duration explicit", () => {
    expect(() => parseDurationToMinutes("")).toThrow("Informe o tempo trabalhado");
    expect(() => parseDurationToMinutes("8:60")).toThrow("Verifique o tempo trabalhado");
    expect(() => parseDurationToMinutes("-1:00")).toThrow("Informe o tempo trabalhado");
  });

  it.each(["0", "0:00", "8 30", "8.5", "8,5", "abc", "1:99", "9007199254740991h"])(
    "rejects ambiguous, zero or unsafe duration %s", (value) => {
      expect(() => parseDurationToMinutes(value)).toThrow();
    },
  );

  it.each([1, 45, 59, 60, 510, 1440, 1501])("preserves %i backend minutes during editing", (minutes) => {
    expect(parseDurationToMinutes(formatDurationInput(minutes))).toBe(minutes);
  });
});
