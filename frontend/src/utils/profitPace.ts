export type ProfitPace = { label: string; tone: string };

/** Top of the profit-per-hour gauge: R$ 80,00/h. */
export const GAUGE_MAX_PER_HOUR_CENTS = 8_000n;

/** Needle angle in degrees, from -90 (R$ 0/h or a loss) to 90 (gauge max or above). */
export function toGaugeAngle(profitPerHourCents: bigint): number {
  if (profitPerHourCents <= 0n) return -90;
  if (profitPerHourCents >= GAUGE_MAX_PER_HOUR_CENTS) return 90;
  const permille = (profitPerHourCents * 1000n) / GAUGE_MAX_PER_HOUR_CENTS;
  return -90 + (Number(permille) * 180) / 1000;
}

/** Pace label for a profit per hour: a loss, below R$ 20/h, R$ 20-40/h, or R$ 40/h and up. */
export function getProfitPace(profitPerHourCents: bigint): ProfitPace {
  if (profitPerHourCents < 0n) return { label: "No prejuízo", tone: "text-rose-400" };
  if (profitPerHourCents < 2_000n) return { label: "Abaixo da média", tone: "text-amber-400" };
  if (profitPerHourCents < 4_000n) return { label: "Na média", tone: "text-zinc-300" };
  return { label: "Excelente", tone: "text-emerald-400" };
}
