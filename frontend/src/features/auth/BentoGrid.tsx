import { useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

import { GlowCard } from "../../components/GlowCard";
import { divideAndRound, formatCents } from "../../utils/money";
import { formatWorkTime } from "../../utils/formatters";
import { projectWeeklyGoal, simulateDemoDay } from "./demoDay";
import { MaskLine } from "./MaskLine";
import { SectionIndex } from "./SectionIndex";
import { reveal, spring, stagger } from "./motion";

// Same illustrative day as the hero simulator, so every number on the page agrees.
const DEMO_KM = 195;
const demoDay = simulateDemoDay(530, DEMO_KM);
const demoGoal = projectWeeklyGoal(demoDay);
const grossPerKmCents = divideAndRound(demoDay.grossCents, BigInt(DEMO_KM));
const goalShare = Number(demoGoal.progressPermille) / 1000;

const RING_RADIUS = 42;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const maintenanceItems = [
  { label: "Troca de óleo", due: "em 1.240 km", status: "Em breve", tone: "text-amber-300 bg-amber-400/10 border-amber-400/20" },
  { label: "Pneus dianteiros", due: "em 8.900 km", status: "Em dia", tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
  { label: "Revisão anual", due: "em 32 dias", status: "Em dia", tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20" },
];

function PerKmVisual() {
  const rows = [
    { label: "Faturamento", cents: grossPerKmCents, bar: "bg-white/[0.25]", scale: 1 },
    { label: "Lucro real", cents: demoDay.profitPerKmCents, bar: "bg-emerald-400", scale: Number(demoDay.profitPerKmCents) / Number(grossPerKmCents) },
  ];

  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5 text-sm">
          <span className="flex justify-between gap-3">
            <span className="text-zinc-400">{row.label}</span>
            <span className="text-white tabular-nums">{formatCents(row.cents)}/km</span>
          </span>
          <span className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.span
              className={`block h-full w-full origin-left rounded-full ${row.bar}`}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: row.scale }}
              viewport={{ once: true }}
              transition={spring.gentle}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function GoalVisual() {
  return (
    <div className="flex flex-col items-center gap-4 py-2" aria-hidden="true">
      <div className="relative h-32 w-32 md:h-40 md:w-40">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={RING_RADIUS} fill="none" strokeWidth="8" className="stroke-white/[0.06]" />
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-emerald-400"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - goalShare)}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-2xl font-semibold text-white tabular-nums">{Math.round(goalShare * 100)}%</strong>
          <span className="text-xs text-zinc-500">da meta</span>
        </span>
      </div>
      <p className="text-center text-sm text-zinc-400">
        Faltam <strong className="text-white font-medium tabular-nums">{formatCents(demoGoal.remainingCents)}</strong>
        {demoGoal.extraMinutes !== null && <> · cerca de {formatWorkTime(Number(demoGoal.extraMinutes))} no ritmo de hoje</>}
      </p>
    </div>
  );
}

function MaintenanceVisual() {
  return (
    <ul className="flex flex-col divide-y divide-white/[0.06]" aria-hidden="true">
      {maintenanceItems.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span className="flex flex-col sm:flex-row sm:gap-2">
            <span className="text-zinc-200">{item.label}</span>
            <span className="text-zinc-500">{item.due}</span>
          </span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${item.tone}`}>{item.status}</span>
        </li>
      ))}
    </ul>
  );
}

type BentoCard = {
  title: string;
  description: string;
  tagline: string;
  icon: ReactNode;
  visual: ReactNode;
  className: string;
};

const iconPath = (d: string) => <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />;

const bentoCards: BentoCard[] = [
  {
    title: "Lucro real por quilômetro",
    description: "Descubra quanto sobrou limpo em cada jornada depois de abater combustível e desgaste por km.",
    tagline: "Rendimento transparente",
    icon: iconPath("M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"),
    visual: <PerKmVisual />,
    className: "md:col-span-2",
  },
  {
    title: "Metas e horas restantes",
    description: "Defina sua meta semanal ou mensal e saiba quantas horas a mais precisa rodar para chegar lá.",
    tagline: "Previsibilidade no volante",
    icon: iconPath("M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"),
    visual: <GoalVisual />,
    className: "md:row-span-2",
  },
  {
    title: "Manutenção e veículos",
    description: "Acompanhe óleo, pneus e revisões por quilometragem e nunca seja pego de surpresa no mecânico.",
    tagline: "Zero surpresas no mecânico",
    icon: (
      <>
        {iconPath("M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z")}
        {iconPath("M15 12a3 3 0 11-6 0 3 3 0 016 0z")}
      </>
    ),
    visual: <MaintenanceVisual />,
    className: "md:col-span-2",
  },
];

/** Asymmetric feature grid where each card shows the feature with real-looking data. */
export function BentoGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className="max-w-6xl mx-auto flex flex-col gap-16"
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={stagger()}
    >
      <motion.div className="text-center max-w-2xl mx-auto flex flex-col gap-3" variants={stagger(0.1, 0)}>
        <SectionIndex index="02" label="Tecnologia feita para o trânsito" className="flex justify-center" />
        <h2 className="text-3xl sm:text-4xl font-medium text-white tracking-[-0.03em]">
          <MaskLine>Tudo o que você precisa</MaskLine>
          <MaskLine>para dominar suas finanças</MaskLine>
        </h2>
        <motion.p className="text-zinc-400 text-sm sm:text-base leading-relaxed" variants={reveal}>
          Pensado para quem dirige por aplicativo: menos planilha e mais clareza sobre o que sobra no bolso.
        </motion.p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {bentoCards.map((card) => (
          <GlowCard
            key={card.title}
            className={`${card.className} p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] transition-colors duration-300 flex flex-col gap-6`}
            variants={reveal}
          >
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  {card.icon}
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white tracking-tight">{card.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{card.description}</p>
            </div>
            <div className="flex flex-1 flex-col justify-center rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">{card.visual}</div>
            <div className="pt-4 border-t border-white/[0.04] text-xs text-emerald-400 font-medium">{card.tagline}</div>
          </GlowCard>
        ))}
      </div>
    </motion.div>
  );
}
