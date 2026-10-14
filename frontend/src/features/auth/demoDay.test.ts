import { describe, expect, it } from "vitest";

import { projectWeeklyGoal, simulateDemoDay } from "./demoDay";

describe("simulateDemoDay", () => {
  it("subtracts fuel, maintenance and daily extras from gross revenue", () => {
    expect(simulateDemoDay(530, 195)).toEqual({
      grossCents: 53_000n,
      fuelCents: 10_973n,
      maintenanceCents: 2_730n,
      extrasCents: 1_200n,
      costsCents: 14_903n,
      profitCents: 38_097n,
      marginPercent: 72n,
      profitPerHourCents: 5_715n,
      profitPerKmCents: 195n,
    });
  });

  it("reports a loss when driving costs exceed revenue", () => {
    const day = simulateDemoDay(150, 400);

    expect(day.costsCents).toBe(29_309n);
    expect(day.profitCents).toBe(-14_309n);
    expect(day.marginPercent).toBe(-95n);
    expect(day.profitPerHourCents).toBe(-2_146n);
    expect(day.profitPerKmCents).toBe(-36n);
  });
});

describe("projectWeeklyGoal", () => {
  it("estimates the extra driving time at today's pace", () => {
    expect(projectWeeklyGoal(simulateDemoDay(530, 195))).toEqual({
      progressCents: 248_097n,
      remainingCents: 31_903n,
      progressPermille: 886n,
      extraMinutes: 335n,
    });
  });

  it("cannot estimate extra time after a losing day", () => {
    const goal = projectWeeklyGoal(simulateDemoDay(150, 400));

    expect(goal.remainingCents).toBe(84_309n);
    expect(goal.progressPermille).toBe(699n);
    expect(goal.extraMinutes).toBeNull();
  });

  it("caps progress once the goal is reached", () => {
    const goal = projectWeeklyGoal(simulateDemoDay(900, 50));

    expect(goal.progressCents).toBe(295_286n);
    expect(goal.remainingCents).toBe(0n);
    expect(goal.progressPermille).toBe(1000n);
    expect(goal.extraMinutes).toBe(0n);
  });
});
