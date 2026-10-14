import { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { Odometer } from "../../components/Odometer";
import { formatCents } from "../../utils/money";
import { MaskLine } from "./MaskLine";
import { STORY_FALLS, getStorySteps, simulateDemoDay, toStoryStage } from "./demoDay";
import { stagger } from "./motion";

// Same illustrative day as the hero simulator.
const day = simulateDemoDay(530, 195);
const steps = getStorySteps(day);
const captions = ["Faturamento do dia", "Depois do combustível", "Depois da manutenção", "Lucro real do dia"];

type Cost = {
  label: string;
  cents: bigint;
  bar: string;
  text: string;
  fall: readonly [number, number];
  tilt: number;
};

const costs: Cost[] = [
  { label: "Combustível", cents: day.fuelCents, bar: "bg-rose-400", text: "text-rose-300", fall: STORY_FALLS[0], tilt: 9 },
  { label: "Manutenção", cents: day.maintenanceCents, bar: "bg-amber-400", text: "text-amber-300", fall: STORY_FALLS[1], tilt: -7 },
  { label: "Alimentação e pedágios", cents: day.extrasCents, bar: "bg-zinc-400", text: "text-zinc-300", fall: STORY_FALLS[2], tilt: 12 },
];

/** Static flex-basis for a share of the day's revenue. */
function share(cents: bigint): string {
  return `${Number((cents * 10_000n) / day.grossCents) / 100}%`;
}

/** A cost segment that drops off the end of the revenue bar while its scroll range passes. */
function FallingCost({ cost, progress, className }: { cost: Cost; progress: MotionValue<number>; className: string }) {
  const [start, end] = cost.fall;
  const y = useTransform(progress, [start, end], [0, 160]);
  const rotate = useTransform(progress, [start, end], [0, cost.tilt]);
  const opacity = useTransform(progress, [start, end], [1, 0]);

  return <motion.div className={`h-full ${cost.bar} ${className}`} style={{ flexBasis: share(cost.cents), y, rotate, opacity }} />;
}

/** A receipt line that writes itself in as its cost falls. */
function ReceiptLine({ cost, progress }: { cost: Cost; progress: MotionValue<number> }) {
  const [start, end] = cost.fall;
  const opacity = useTransform(progress, [start + 0.04, end], [0, 1]);
  const x = useTransform(progress, [start + 0.04, end], [-16, 0]);

  return (
    <motion.li className="flex items-baseline justify-between gap-4 text-sm" style={{ opacity, x }}>
      <span className="text-zinc-400">{cost.label}</span>
      <span className={`font-medium tabular-nums ${cost.text}`}>-{formatCents(cost.cents)}</span>
    </motion.li>
  );
}

/**
 * Scroll-told story of one workday: the revenue bar stays pinned while each
 * cost falls off it and the odometer counts down to the real profit. Every
 * moving part is a transform or opacity bound to scroll, so it reverses when
 * scrolling back; with reduced motion the section shows its final state.
 */
export function ScrollStory() {
  const ref = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const settled = useMotionValue(1);
  const progress = shouldReduceMotion ? settled : scrollYProgress;
  const [stage, setStage] = useState(() => toStoryStage(progress.get()));
  useMotionValueEvent(progress, "change", (value) => setStage(toStoryStage(value)));

  const [lastFallStart, lastFallEnd] = STORY_FALLS[STORY_FALLS.length - 1];
  const profitGlow = useTransform(progress, [lastFallEnd, lastFallEnd + 0.1], [0, 1]);
  const profitLine = useTransform(progress, [lastFallStart + 0.1, lastFallEnd + 0.06], [0, 1]);
  const isProfit = stage === steps.length - 1;

  return (
    <section
      ref={ref}
      aria-label="Do faturamento ao lucro real"
      className={`relative bg-(--color-lux-void) before:pointer-events-none before:absolute before:inset-x-0 before:-top-16 before:h-16 before:bg-gradient-to-b before:from-transparent before:to-(--color-lux-void) lg:before:-top-32 lg:before:h-32 ${shouldReduceMotion ? "py-24" : "h-[220vh] lg:h-[260vh]"}`}
    >
      <div className={shouldReduceMotion ? "" : "sticky top-0 flex h-[100svh] items-center"}>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <div className="flex flex-col gap-6">
            <motion.div
              className="flex flex-col gap-4"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.6 }}
              variants={stagger(0.12, 0)}
            >
              <MaskLine className="text-xs font-semibold uppercase tracking-widest text-emerald-400">O dia de um motorista</MaskLine>
              <h2 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                <MaskLine>Faturamento</MaskLine>
                <MaskLine className="text-zinc-500">não é lucro.</MaskLine>
              </h2>
            </motion.div>
            <p className="max-w-md text-base leading-relaxed text-zinc-400">
              {shouldReduceMotion
                ? "Veja quanto cada custo tira do que você faturou no dia."
                : "Role a página e veja cada custo sair do que você faturou no dia."}
            </p>
            <div className="flex flex-col gap-1">
              <strong className={`text-5xl font-semibold tracking-[-0.03em] transition-colors duration-500 sm:text-6xl ${isProfit ? "text-emerald-400" : "text-white"}`}>
                <Odometer value={formatCents(steps[stage])} />
              </strong>
              <span className="text-sm text-zinc-500">{captions[stage]}</span>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="relative" aria-hidden="true">
              <div className="relative flex h-16 w-full gap-[3px] sm:h-20">
                {/* Ghost outline of what the costs took */}
                <div
                  className="absolute inset-y-0 right-0 rounded-l-md rounded-r-2xl border border-dashed border-white/[0.12]"
                  style={{ width: `calc(${share(day.costsCents)} - 3px)` }}
                />
                <div className="relative h-full" style={{ flexBasis: share(day.profitCents) }}>
                  <motion.div
                    className="absolute -inset-6 rounded-3xl bg-[radial-gradient(closest-side,var(--color-lux-glow),transparent)]"
                    style={{ opacity: profitGlow }}
                  />
                  <div className="relative h-full rounded-l-2xl rounded-r-md bg-emerald-400" />
                </div>
                <FallingCost cost={costs[2]} progress={progress} className="rounded-md" />
                <FallingCost cost={costs[1]} progress={progress} className="rounded-md" />
                <FallingCost cost={costs[0]} progress={progress} className="rounded-l-md rounded-r-2xl" />
              </div>
              <div className="mt-3 flex justify-between text-xs text-zinc-500">
                <span>R$ 0</span>
                <span>{formatCents(day.grossCents)} faturados</span>
              </div>
            </div>

            <ul className="flex flex-col gap-3 border-t border-white/[0.06] pt-6">
              {costs.map((cost) => (
                <ReceiptLine key={cost.label} cost={cost} progress={progress} />
              ))}
              <motion.li
                className="flex items-baseline justify-between gap-4 border-t border-white/[0.06] pt-3 text-base"
                style={{ opacity: profitLine }}
              >
                <span className="text-white">Sobra no bolso</span>
                <span className="font-semibold tabular-nums text-emerald-400">
                  {formatCents(day.profitCents)} · {day.marginPercent.toString()}%
                </span>
              </motion.li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
