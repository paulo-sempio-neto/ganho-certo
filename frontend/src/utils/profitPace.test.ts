import { describe, expect, it } from "vitest";

import { getProfitPace, getProfitPerHourCents, toGaugeAngle } from "./profitPace";

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

describe("getProfitPerHourCents", () => {
  it("spreads the day's net profit over the worked hours, rounding half away from zero", () => {
    expect(getProfitPerHourCents("299.43", 480)).toBe(3_743n);
    expect(getProfitPerHourCents("-80.00", 120)).toBe(-4_000n);
  });

  it("has no pace without worked time", () => {
    expect(getProfitPerHourCents("120.00", 0)).toBeNull();
    expect(getProfitPerHourCents("120.00", Number.NaN)).toBeNull();
  });
});
