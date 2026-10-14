import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Odometer } from "../../components/Odometer";
import { formatWorkTime } from "../../utils/formatters";
import { formatCents } from "../../utils/money";
import { DEMO_ASSUMPTIONS, projectWeeklyGoal, simulateDemoDay } from "./demoDay";
import { panelSwap, reveal, spring } from "./motion";
import { ProfitGauge } from "./ProfitGauge";

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
function toRatio(part: bigint, whole: bigint): number {
  const permille = (part * 1000n) / whole;
  return Math.min(Math.max(Number(permille) / 1000, 0), 1);
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;

/** Bar heights (0..1) for the previous days and today, scaled to the best day. */
function getWeekBars(todayCents: bigint) {
  const days = [...DEMO_ASSUMPTIONS.previousDaysCents, todayCents];
  const best = days.reduce((max, cents) => (cents > max ? cents : max), 1n);
  return days.map((cents, index) => ({
    label: index < WEEKDAY_LABELS.length ? WEEKDAY_LABELS[index] : "Hoje",
    isToday: index === WEEKDAY_LABELS.length,
    height: toRatio(cents, best),
  }));
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
  const week = getWeekBars(day.profitCents);

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

      {/* Conteúdo Dinâmico do Mockup: altura reservada para a aba mais alta, sem pulo de layout */}
      <div className="sm:min-h-[10.75rem]">
      <AnimatePresence mode="wait">
        {activeTab === "visao" && (
          <motion.div
            key="visao"
            {...panelSwap}
            className="grid items-center gap-5 sm:grid-cols-[auto_1fr] sm:gap-8"
          >
            <ProfitGauge profitPerHourCents={day.profitPerHourCents} pace={pace} />
            <div className="flex flex-col gap-3">
              <dl className="flex flex-col divide-y divide-white/[0.06] text-sm">
                <div className="flex items-baseline justify-between gap-3 pb-2.5">
                  <dt className="text-zinc-400">Lucro real</dt>
                  <dd className={`text-2xl font-semibold tracking-tight ${profitTone}`}>
                    <Odometer value={formatCents(day.profitCents)} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-zinc-400">Faturamento</dt>
                  <dd className="text-lg font-medium text-white">
                    <Odometer value={grossLabel} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 pt-2.5">
                  <dt className="text-zinc-400">Custos do dia</dt>
                  <dd className="text-lg font-medium text-rose-400">
                    <Odometer value={`-${formatCents(day.costsCents)}`} />
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-zinc-500">
                Margem de {day.marginPercent.toString()}% · {formatCents(day.profitPerKmCents)}/km · {km} km em{" "}
                {formatWorkTime(Number(DEMO_ASSUMPTIONS.workedMinutes))}
              </p>
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
                      animate={{ scaleX: toRatio(cost.cents, day.grossCents) }}
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
              <motion.div
                className="h-full w-full origin-left rounded-full bg-emerald-400"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Number(goal.progressPermille) / 1000 }}
                transition={spring.gentle}
              />
            </div>

            {/* Profit per day of the week, today included */}
            <div className="flex items-end gap-2" aria-hidden="true">
              {week.map((weekDay) => (
                <div key={weekDay.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-12 w-full items-end justify-center">
                    <motion.div
                      className={`h-full w-3 sm:w-4 origin-bottom rounded-t-full rounded-b-sm ${weekDay.isToday ? (day.profitCents < 0n ? "bg-rose-400" : "bg-emerald-400") : "bg-white/[0.12]"}`}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: weekDay.height }}
                      transition={spring.gentle}
                    />
                  </div>
                  <span className={`text-xs ${weekDay.isToday ? "text-zinc-200" : "text-zinc-500"}`}>{weekDay.label}</span>
                </div>
              ))}
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
      </div>
    </motion.div>
  );
}
