import { divideAndRound } from "../../utils/money";

/** Profit already made on the five previous days of the illustrative week. */
const PREVIOUS_DAYS_CENTS = [41_200n, 38_800n, 45_500n, 40_100n, 44_400n] as const;

/** Illustrative assumptions behind the landing-page simulator. Not user data. */
export const DEMO_ASSUMPTIONS = {
  fuelPricePerLiterCents: 619n,
  kmPerLiter: 11n,
  maintenancePerKmCents: 14n,
  dailyExtrasCents: 1_200n,
  workedMinutes: 400n,
  weeklyGoalCents: 280_000n,
  previousDaysCents: PREVIOUS_DAYS_CENTS,
  weekSoFarCents: PREVIOUS_DAYS_CENTS.reduce((total, day) => total + day, 0n),
} as const;

export type DemoDay = {
  grossCents: bigint;
  fuelCents: bigint;
  maintenanceCents: bigint;
  extrasCents: bigint;
  costsCents: bigint;
  profitCents: bigint;
  marginPercent: bigint;
  profitPerHourCents: bigint;
  profitPerKmCents: bigint;
};

export type DemoGoal = {
  progressCents: bigint;
  remainingCents: bigint;
  /** Share of the weekly goal reached, from 0 to 1000. */
  progressPermille: bigint;
  /** Extra driving time needed at today's pace; null when today ran at a loss. */
  extraMinutes: bigint | null;
};

/** Simulates one workday from whole reais and kilometres (both must be positive). */
export function simulateDemoDay(grossReais: number, km: number): DemoDay {
  const assumptions = DEMO_ASSUMPTIONS;
  const grossCents = BigInt(grossReais) * 100n;
  const distance = BigInt(km);
  const fuelCents = divideAndRound(distance * assumptions.fuelPricePerLiterCents, assumptions.kmPerLiter);
  const maintenanceCents = distance * assumptions.maintenancePerKmCents;
  const extrasCents = assumptions.dailyExtrasCents;
  const costsCents = fuelCents + maintenanceCents + extrasCents;
  const profitCents = grossCents - costsCents;

  return {
    grossCents,
    fuelCents,
    maintenanceCents,
    extrasCents,
    costsCents,
    profitCents,
    marginPercent: divideAndRound(profitCents * 100n, grossCents),
    profitPerHourCents: divideAndRound(profitCents * 60n, assumptions.workedMinutes),
    profitPerKmCents: divideAndRound(profitCents, distance),
  };
}

/** Projects today's result onto the illustrative weekly goal. */
export function projectWeeklyGoal(day: DemoDay): DemoGoal {
  const goal = DEMO_ASSUMPTIONS.weeklyGoalCents;
  const progressCents = DEMO_ASSUMPTIONS.weekSoFarCents + day.profitCents;
  const remainingCents = progressCents >= goal ? 0n : goal - progressCents;
  const reached = progressCents < 0n ? 0n : progressCents > goal ? goal : progressCents;

  let extraMinutes: bigint | null = null;
  if (remainingCents === 0n) extraMinutes = 0n;
  else if (day.profitPerHourCents > 0n) extraMinutes = divideAndRound(remainingCents * 60n, day.profitPerHourCents);

  return {
    progressCents,
    remainingCents,
    progressPermille: divideAndRound(reached * 1000n, goal),
    extraMinutes,
  };
}
