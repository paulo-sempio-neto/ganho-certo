import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { formatWorkTime } from "../../utils/formatters";
import { formatCents } from "../../utils/money";
import { DEMO_ASSUMPTIONS, projectWeeklyGoal, simulateDemoDay } from "./demoDay";
import { panelSwap, reveal, spring } from "./motion";

type CanvasTab = "visao" | "custos" | "metas";

const GROSS_RANGE = { min: 150, max: 900, step: 10 } as const;
const KM_RANGE = { min: 50, max: 400, step: 5 } as const;

function getPace(profitPerHourCents: bigint): { label: string; tone: string } {
  if (profitPerHourCents < 0n) return { label: "No prejuízo", tone: "text-rose-400" };
  if (profitPerHourCents < 2_000n) return { label: "Abaixo da média", tone: "text-amber-400" };
  if (profitPerHourCents < 4_000n) return { label: "Na média", tone: "text-zinc-300" };
  return { label: "Excelente", tone: "text-emerald-400" };
}

/** Visual-only ratio (0..1) for bar lengths; money itself never leaves bigint cents. */
function shareOfRevenue(cents: bigint, grossCents: bigint): number {
  const permille = (cents * 1000n) / grossCents;
  return Math.min(Math.max(Number(permille) / 1000, 0), 1);
}

/** Interactive product mockup: drag the day's revenue and distance, read the real profit. */
export function ProductCanvas({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<CanvasTab>("visao");
  const [grossReais, setGrossReais] = useState(530);
  const [km, setKm] = useState(195);
  const day = simulateDemoDay(grossReais, km);
  const goal = projectWeeklyGoal(day);
  const pace = getPace(day.profitPerHourCents);
  const profitTone = day.profitCents < 0n ? "text-rose-400" : "text-emerald-400";
  const grossLabel = formatCents(day.grossCents);

  return (
    <motion.div
      variants={reveal}
      className={`${className} w-full rounded-2xl bg-zinc-950/80 border border-white/[0.08] p-6 shadow-[0_20px_50px_var(--color-glass-shadow)] lg:backdrop-blur-xl relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(closest-side,var(--color-glass-focus-glow),transparent)] pointer-events-none" />

      {/* Header do Mockup */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06] mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_var(--color-accent-emerald)]" />
          <span className="text-xs font-medium text-zinc-300">Simule o seu dia</span>
        </div>
        <div className="flex gap-1.5 bg-white/[0.04] p-1 rounded-lg border border-white/[0.04] text-sm" role="group" aria-label="Visão do painel">
          {([["visao", "Resumo"], ["custos", "Custos"], ["metas", "Meta"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeTab === key}
              onClick={() => setActiveTab(key)}
              className={`relative px-2.5 py-0.5 rounded transition-colors ${activeTab === key ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {activeTab === key && (
                <motion.span
                  layoutId="mockup-tab-indicator"
                  className="absolute inset-0 rounded bg-white/[0.1]"
                  transition={spring.snappy}
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controles do simulador */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mb-5">
        <label>
          <span className="flex items-baseline justify-between gap-3 font-medium">
            <span className="text-zinc-400">Faturamento do dia</span>
            <output className="text-white tabular-nums">{grossLabel}</output>
          </span>
          <input
            type="range"
            {...GROSS_RANGE}
            value={grossReais}
            aria-valuetext={grossLabel}
            onChange={(event) => setGrossReais(Number(event.target.value))}
          />
        </label>
        <label>
          <span className="flex items-baseline justify-between gap-3 font-medium">
            <span className="text-zinc-400">Km rodados</span>
            <output className="text-white tabular-nums">{km} km</output>
          </span>
          <input
            type="range"
            {...KM_RANGE}
            value={km}
            aria-valuetext={`${km} quilômetros`}
            onChange={(event) => setKm(Number(event.target.value))}
          />
        </label>
      </div>

      {/* Conteúdo Dinâmico do Mockup */}
      <AnimatePresence mode="wait">
        {activeTab === "visao" && (
          <motion.div
            key="visao"
            {...panelSwap}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider block mb-1">Lucro real</span>
                <strong className={`text-xl sm:text-2xl font-semibold tracking-tight tabular-nums ${profitTone}`}>{formatCents(day.profitCents)}</strong>
                <span className="text-sm text-zinc-400 mt-1 block">Margem de {day.marginPercent.toString()}%</span>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider block mb-1">Faturamento</span>
                <strong className="text-xl sm:text-2xl font-semibold text-white tracking-tight tabular-nums">{grossLabel}</strong>
                <span className="text-sm text-zinc-400 mt-1 block">{km} km · {formatWorkTime(Number(DEMO_ASSUMPTIONS.workedMinutes))}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider block mb-1">Custos do dia</span>
                <strong className="text-xl sm:text-2xl font-semibold text-rose-400 tracking-tight tabular-nums">-{formatCents(day.costsCents)}</strong>
                <span className="text-sm text-zinc-400 mt-1 block">Combustível + manutenção</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-zinc-400 flex flex-wrap items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Lucro por hora:
                <strong className="text-white font-medium tabular-nums">{formatCents(day.profitPerHourCents)}/h</strong>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <strong className="text-white font-medium tabular-nums">{formatCents(day.profitPerKmCents)}/km</strong>
              </span>
              <span className={`font-medium ${pace.tone}`}>{pace.label}</span>
            </div>
          </motion.div>
        )}

        {activeTab === "custos" && (
          <motion.div
            key="custos"
            {...panelSwap}
            className="flex flex-col gap-3"
          >
            <ul className="flex flex-col gap-3">
              {[
                { label: "Combustível", detail: "R$ 6,19/L · 11 km/L", cents: day.fuelCents, tone: "text-rose-400", bar: "bg-rose-400" },
                { label: "Manutenção", detail: "R$ 0,14/km", cents: day.maintenanceCents, tone: "text-amber-400", bar: "bg-amber-400" },
                { label: "Alimentação e pedágios", detail: "fixo", cents: day.extrasCents, tone: "text-zinc-400", bar: "bg-zinc-500" },
              ].map((cost) => (
                <li key={cost.label} className="flex flex-col gap-1.5 text-sm">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-zinc-200">
                      {cost.label} <span className="hidden sm:inline text-zinc-500">· {cost.detail}</span>
                    </span>
                    <span className={`font-semibold tabular-nums ${cost.tone}`}>-{formatCents(cost.cents)}</span>
                  </span>
                  {/* Share of the day's revenue eaten by this cost */}
                  <span className="h-1 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
                    <motion.span
                      className={`block h-full w-full origin-left rounded-full ${cost.bar}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: shareOfRevenue(cost.cents, day.grossCents) }}
                      transition={spring.gentle}
                    />
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-sm">
              <span className="text-zinc-400">Sobra no bolso</span>
              <strong className={`font-semibold tabular-nums ${profitTone}`}>{formatCents(day.profitCents)}</strong>
            </div>
          </motion.div>
        )}

        {activeTab === "metas" && (
          <motion.div
            key="metas"
            {...panelSwap}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-zinc-400">Meta semanal de lucro</span>
              <strong className="text-white font-semibold tabular-nums">
                {formatCents(goal.progressCents)} de {formatCents(DEMO_ASSUMPTIONS.weeklyGoalCents)}
              </strong>
            </div>
            <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full w-full origin-left rounded-full bg-emerald-400"
                style={{ transform: `scaleX(${Number(goal.progressPermille) / 1000})` }}
              />
            </div>
            <span className="text-sm text-emerald-400 font-medium">
              {goal.remainingCents === 0n
                ? "Meta da semana batida!"
                : goal.extraMinutes === null
                  ? `Faltam ${formatCents(goal.remainingCents)}. Com prejuízo hoje, rodar mais só aumenta a perda.`
                  : `Faltam ${formatCents(goal.remainingCents)} · cerca de ${formatWorkTime(Number(goal.extraMinutes))} a mais no ritmo de hoje.`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
