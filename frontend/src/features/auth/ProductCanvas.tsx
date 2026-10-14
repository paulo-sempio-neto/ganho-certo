import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { panelSwap, reveal, spring } from "./motion";

type CanvasTab = "visao" | "custos" | "metas";

/** Live product mockup shown next to the auth form. */
export function ProductCanvas({ className = "" }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<CanvasTab>("visao");

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
          <span className="text-xs font-medium text-zinc-300">Jornada Ativa · Hoje</span>
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
                <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider block mb-1">Lucro Líquido Real</span>
                <strong className="text-xl sm:text-2xl font-semibold text-emerald-400 tracking-tight">R$ 384,50</strong>
                <span className="text-sm text-emerald-500/80 mt-1 block">Margem: 72%</span>
              </div>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider block mb-1">Faturamento Bruto</span>
                <strong className="text-xl sm:text-2xl font-semibold text-white tracking-tight">R$ 534,00</strong>
                <span className="text-sm text-zinc-400 mt-1 block">14 corridas · 6h 40m</span>
              </div>
              <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider block mb-1">Despesas do Dia</span>
                <strong className="text-xl sm:text-2xl font-semibold text-rose-400 tracking-tight">-R$ 149,50</strong>
                <span className="text-sm text-zinc-400 mt-1 block">Combustível + Reserva</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Rendimento médio: <strong className="text-white font-medium">R$ 57,60 / hora trabalhada</strong>
              </span>
              <span className="text-emerald-400 font-medium">Excelente</span>
            </div>
          </motion.div>
        )}

        {activeTab === "custos" && (
          <motion.div
            key="custos"
            {...panelSwap}
            className="flex flex-col gap-2.5"
          >
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
              <span className="text-zinc-300">Combustível (Gasolina / GNV)</span>
              <span className="font-semibold text-rose-400">-R$ 110,00</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
              <span className="text-zinc-300">Provisão de Manutenção (Óleo, Pneus)</span>
              <span className="font-semibold text-amber-400">-R$ 27,50</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">
              <span className="text-zinc-300">Alimentação e Pedágios</span>
              <span className="font-semibold text-zinc-400">-R$ 12,00</span>
            </div>
          </motion.div>
        )}

        {activeTab === "metas" && (
          <motion.div
            key="metas"
            {...panelSwap}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Meta Semanal de Lucro</span>
              <strong className="text-white font-semibold">R$ 2.450 de R$ 2.800</strong>
            </div>
            <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: "87.5%" }} />
            </div>
            <span className="text-sm text-emerald-400 font-medium">87.5% atingida · Faltam apenas R$ 350 para fechar a semana!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
