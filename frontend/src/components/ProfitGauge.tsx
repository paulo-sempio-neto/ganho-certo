import { motion } from "framer-motion";

import { Odometer } from "./Odometer";
import { formatCents } from "../utils/money";
import { toGaugeAngle, type ProfitPace } from "../utils/profitPace";

// Arc geometry in a 120x66 viewBox: centre (60, 60), radius 50.
const CENTER_X = 60;
const CENTER_Y = 60;
const RADIUS = 50;

/** Underdamped on purpose: the needle overshoots and settles like a real gauge. */
const needleSpring = { type: "spring", stiffness: 160, damping: 11, mass: 0.9 } as const;

/** Point on the arc for a needle angle (-90 = left end, 90 = right end). */
function arcPoint(angle: number, radius = RADIUS): [number, number] {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [CENTER_X + radius * Math.cos(radians), CENTER_Y + radius * Math.sin(radians)];
}

function arcPath(from: number, to: number): string {
  const [x1, y1] = arcPoint(from);
  const [x2, y2] = arcPoint(to);
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2}`;
}

// Zones follow the pace labels: below R$ 20/h, R$ 20-40/h and R$ 40/h or more.
const zones = [
  { from: -90, to: -46.5, className: "stroke-amber-400/60" },
  { from: -43.5, to: -1.5, className: "stroke-zinc-400/40" },
  { from: 1.5, to: 90, className: "stroke-emerald-400" },
];
const ticks = [-90, -45, 0, 45, 90];

type ProfitGaugeProps = {
  profitPerHourCents: bigint;
  pace: ProfitPace;
};

/** Speedometer-style gauge for profit per hour; the needle is a rotated element, nothing else animates. */
export function ProfitGauge({ profitPerHourCents, pace }: ProfitGaugeProps) {
  return (
    <div className="flex flex-col items-center gap-5">
      {/* Explicit 120:66 height instead of aspect-ratio, which older Safari lacks. */}
      <div className="relative h-[6.05rem] w-44" aria-hidden="true">
        <svg viewBox="0 0 120 66" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={arcPath(-90, 90)} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-white/[0.05]" />
          {zones.map((zone) => (
            <path key={zone.from} d={arcPath(zone.from, zone.to)} fill="none" strokeWidth="4" strokeLinecap="round" className={zone.className} />
          ))}
          {ticks.map((tick) => {
            const [x1, y1] = arcPoint(tick, 38);
            const [x2, y2] = arcPoint(tick, 42);
            return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.5" strokeLinecap="round" className="stroke-white/30" />;
          })}
        </svg>
        <motion.div
          className="absolute bottom-[9.09%] left-1/2 h-[62%] w-[2px] -ml-px origin-bottom rounded-full bg-white shadow-[0_0_8px_var(--color-glass-border-hover)]"
          initial={{ rotate: -90 }}
          animate={{ rotate: toGaugeAngle(profitPerHourCents) }}
          transition={needleSpring}
        />
        <span className="absolute bottom-[9.09%] left-1/2 h-3 w-3 -ml-1.5 translate-y-1/2 rounded-full bg-white ring-4 ring-zinc-950" />
        <span className="absolute top-full left-[8.33%] -translate-x-1/2 text-xs text-zinc-600">0</span>
        <span className="absolute top-full right-[8.33%] translate-x-1/2 text-xs text-zinc-600">80</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Lucro por hora</span>
        <strong className="text-lg font-semibold text-white">
          <Odometer value={formatCents(profitPerHourCents)} />
          <span className="text-zinc-500 font-normal">/h</span>
        </strong>
        <span className={`text-sm font-medium ${pace.tone}`}>{pace.label}</span>
      </div>
    </div>
  );
}
