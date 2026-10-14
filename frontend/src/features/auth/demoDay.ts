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

/** Top of the profit-per-hour gauge: R$ 80,00/h. */
export const GAUGE_MAX_PER_HOUR_CENTS = 8_000n;

/** Needle angle in degrees, from -90 (R$ 0/h or a loss) to 90 (gauge max or above). */
export function toGaugeAngle(profitPerHourCents: bigint): number {
  if (profitPerHourCents <= 0n) return -90;
  if (profitPerHourCents >= GAUGE_MAX_PER_HOUR_CENTS) return 90;
  const permille = (profitPerHourCents * 1000n) / GAUGE_MAX_PER_HOUR_CENTS;
  return -90 + (Number(permille) * 180) / 1000;
}

/** Scroll ranges (0..1) in which fuel, maintenance and extras fall off the revenue bar. */
export const STORY_FALLS = [
  [0.15, 0.38],
  [0.38, 0.61],
  [0.61, 0.84],
] as const;

/** How many costs have fallen at a scroll progress: a cost counts once half its fall is done. */
export function toStoryStage(progress: number): number {
  return STORY_FALLS.filter(([start, end]) => progress >= (start + end) / 2).length;
}

/** Money left after each fall: revenue, minus fuel, minus maintenance, minus extras (the real profit). */
export function getStorySteps(day: DemoDay): bigint[] {
  const afterFuel = day.grossCents - day.fuelCents;
  const afterMaintenance = afterFuel - day.maintenanceCents;
  return [day.grossCents, afterFuel, afterMaintenance, afterMaintenance - day.extrasCents];
}
