import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { Odometer } from "../../components/Odometer";
import { ProfitGauge } from "../../components/ProfitGauge";
import { formatCents } from "../../utils/money";
import { getProfitPace } from "../../utils/profitPace";
import { MaskLine } from "./MaskLine";
import { SectionIndex } from "./SectionIndex";
import { projectWeeklyGoal, simulateDemoDay } from "./demoDay";
import { reveal, stagger } from "./motion";

// Same illustrative day as the hero simulator and the story.
const day = simulateDemoDay(530, 195);
const goal = projectWeeklyGoal(day);

type Moment = { time: string; title: string; text: string; visual: ReactNode };

const moments: Moment[] = [
  {
    time: "06:00",
    title: "Começo do dia",
    text: "Escolha o carro e comece a jornada. O GanhoCerto lembra do último veículo usado.",
    visual: (
      <span className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm">
        <span className="text-zinc-300">Carro principal</span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300">Selecionado</span>
      </span>
    ),
  },
  {
    time: "09:30",
    title: "No posto",
    text: "Abasteceu? Registre o gasto pelo celular ali mesmo, sem planilha.",
    visual: (
      <span className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm">
        <span className="flex flex-col">
          <span className="text-zinc-300">Combustível</span>
          <span className="text-xs text-emerald-400">Registrado</span>
        </span>
        <span className="font-semibold tabular-nums text-rose-300">-{formatCents(day.fuelCents)}</span>
      </span>
    ),
  },
  {
    time: "13:00",
    title: "Na pausa",
    text: "Confira quanto falta para a meta da semana e o ritmo necessário para fechar.",
    visual: (
      <span className="flex flex-col gap-2 text-sm">
        <span className="flex justify-between text-zinc-400">
          <span>Meta da semana</span>
          <span className="tabular-nums text-white">{Math.round(Number(goal.progressPermille) / 10)}%</span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <span className="block h-full origin-left rounded-full bg-emerald-400" style={{ transform: `scaleX(${Number(goal.progressPermille) / 1000})` }} />
        </span>
        <span className="text-xs text-zinc-500">Faltam {formatCents(goal.remainingCents)}</span>
      </span>
    ),
  },
  {
    time: "18:00",
    title: "No pico",
    text: "O velocímetro mostra o lucro por hora do dia, para decidir se vale continuar.",
    visual: <ProfitGauge profitPerHourCents={day.profitPerHourCents} pace={getProfitPace(day.profitPerHourCents)} />,
  },
  {
    time: "22:00",
    title: "Fim do dia",
    text: "Lance o faturamento e veja o que sobrou de verdade: faturamento menos custos.",
    visual: (
      <span className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Lucro real do dia</span>
        <strong className="text-4xl font-semibold tracking-[-0.03em] text-emerald-400">
          <Odometer value={formatCents(day.profitCents)} />
        </strong>
        <span className="text-sm text-zinc-500">{day.marginPercent.toString()}% do faturamento</span>
      </span>
    ),
  },
];

/** Tracks a media query, re-rendering when it flips. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useLayoutEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

function MomentCard({ moment, index }: { moment: Moment; index: number }) {
  return (
    <motion.li
      className="flex w-full shrink-0 flex-col gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:h-[26rem] md:w-[22rem] md:justify-between"
      variants={reveal}
    >
      <span className="flex items-baseline justify-between">
        <span className="text-4xl font-medium tracking-[-0.04em] text-white tabular-nums">{moment.time}</span>
        <span className="text-xs tabular-nums text-zinc-600">0{index + 1} / 0{moments.length}</span>
      </span>
      <span className="flex flex-col gap-2">
        <span className="text-lg font-medium tracking-tight text-white">{moment.title}</span>
        <span className="text-sm leading-relaxed text-zinc-400">{moment.text}</span>
      </span>
      <span className="flex min-h-[7rem] flex-col justify-center rounded-xl bg-white/[0.02] p-3">{moment.visual}</span>
    </motion.li>
  );
}

/**
 * A workday told sideways: while the page scrolls down, the pinned stage
 * slides the day's moments to the left and a car drives along the road
 * below. Vertical list on small screens and under reduced motion.
 */
export function DayTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const isWide = useMediaQuery("(min-width: 768px)");
  const shouldReduceMotion = useReducedMotion();
  const isHorizontal = isWide && !shouldReduceMotion;
  const [distance, setDistance] = useState(0);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const carX = useTransform(scrollYProgress, (value) => `${value * 100}%`);

  useLayoutEffect(() => {
    if (!isHorizontal) return;
    const measure = () => {
      const track = trackRef.current;
      if (track) setDistance(Math.max(0, track.scrollWidth - window.innerWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isHorizontal]);

  const heading = (
    <motion.div className="flex shrink-0 flex-col gap-4 md:w-[26rem] md:justify-center" variants={stagger(0.12, 0)}>
      <SectionIndex index="03" label="Na rua, todo dia" />
      <h2 className="text-4xl font-medium leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">
        <MaskLine>Um dia de trabalho,</MaskLine>
        <MaskLine className="text-zinc-500">do primeiro ao último km.</MaskLine>
      </h2>
    </motion.div>
  );

  if (!isHorizontal) {
    return (
      <section ref={sectionRef} aria-label="Um dia de trabalho" className="w-full border-t border-white/[0.04] bg-(--color-lux-canvas) px-6 py-20">
        <motion.div
          className="mx-auto flex max-w-xl flex-col gap-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={stagger(0.1, 0)}
        >
          {heading}
          <ol className="flex flex-col gap-6">
            {moments.map((moment, index) => (
              <MomentCard key={moment.time} moment={moment} index={index} />
            ))}
          </ol>
        </motion.div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Um dia de trabalho"
      className="relative w-full border-t border-white/[0.04] bg-(--color-lux-canvas)"
      style={{ height: `calc(100vh + ${distance}px)` }}
    >
      <div className="story-stage sticky top-0 flex flex-col justify-center gap-12 overflow-hidden">
        <motion.ol
          ref={trackRef}
          className="flex w-max items-stretch gap-6 px-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] will-change-transform"
          style={{ x }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={stagger(0.08, 0)}
        >
          <li className="flex">{heading}</li>
          {moments.map((moment, index) => (
            <MomentCard key={moment.time} moment={moment} index={index} />
          ))}
        </motion.ol>

        {/* The road: a fill that follows the day and a car that drives along it. */}
        <div aria-hidden="true" className="mx-auto w-full max-w-7xl px-6">
          <div className="relative h-px bg-white/[0.08]">
            <motion.div className="absolute inset-0 origin-left bg-emerald-400/70" style={{ scaleX: scrollYProgress }} />
            <motion.div className="absolute inset-y-0 left-0 w-full" style={{ x: carX }}>
              <span className="absolute left-0 top-1/2 h-3 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_18px_var(--color-lux-glow)]" />
            </motion.div>
          </div>
          <div className="mt-3 flex justify-between text-xs tabular-nums text-zinc-600">
            <span>06:00</span>
            <span>22:00</span>
          </div>
        </div>
      </div>
    </section>
  );
}
