import { describe, expect, it } from "vitest";

import { getProfitPace, toGaugeAngle } from "./profitPace";

describe("toGaugeAngle", () => {
  it("sweeps the needle from -90 to 90 degrees across R$ 0 to R$ 80 per hour", () => {
    expect(toGaugeAngle(0n)).toBe(-90);
    expect(toGaugeAngle(4_000n)).toBe(0);
    expect(toGaugeAngle(5_715n)).toBeCloseTo(38.52, 2);
    expect(toGaugeAngle(8_000n)).toBe(90);
  });

  it("pins the needle at the ends for losses and very good days", () => {
    expect(toGaugeAngle(-2_146n)).toBe(-90);
    expect(toGaugeAngle(12_000n)).toBe(90);
  });
});

describe("getProfitPace", () => {
  it.each([
    [-1n, "No prejuízo"],
    [0n, "Abaixo da média"],
    [1_999n, "Abaixo da média"],
    [2_000n, "Na média"],
    [3_999n, "Na média"],
    [4_000n, "Excelente"],
  ])("labels %s cents per hour as %s", (cents, label) => {
    expect(getProfitPace(cents).label).toBe(label);
  });
});
