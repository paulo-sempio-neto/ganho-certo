import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const affectedFiles = [
  "../App.tsx",
  "../features/result/ResultSection.tsx",
  "../features/result/HistoricalPerformanceSection.tsx",
  "./formatters.ts",
  "./money.ts",
];

describe("corrected frontend text", () => {
  it.each(affectedFiles)("keeps %s free of encoding corruption", (file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");

    // Detect UTF-8 decoded as Latin-1/Windows-1252 and replacement characters.
    expect(source).not.toMatch(/\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080\u20ac]|\ufffd/);
  });
});
