import { FormEvent, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig, useInView } from "framer-motion";
import { FeedbackMessage } from "../../components/FeedbackMessage";
import { AmbientBackground } from "./AmbientBackground";
import { panelSwap, reveal, spring, stagger } from "./motion";

export type AuthMode = "login" | "register";

interface AuthScreenProps {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  name: string;
  setName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  isLoading: boolean;
  message: string;
  successMessage: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onForgotPassword: () => void;
}

const bentoCards = [
  {
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Lucro Real por Quilômetro",
    description: "Descubra quanto sobrou limpo em cada corrida ou jornada após abater automaticamente o custo de combustível por km.",
    cta: "Rendimento transparente →",
  },
  {
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Metas e Horas Restantes",
    description: "Defina sua meta financeira semanal ou mensal e saiba exatamente quantas horas a mais precisa rodar para atingi-la.",
    cta: "Previsibilidade no volante →",
  },
  {
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    secondIcon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    title: "Manutenção e Veículos",
    description: "Controle trocas de óleo, pneus e revisões periódicas. Nunca seja pego de surpresa por quebras inesperadas no carro.",
    cta: "Zero surpresas no mecânico →",
  },
];

function BentoGridSection() {
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
      <motion.div className="text-center max-w-2xl mx-auto flex flex-col gap-3" variants={reveal}>
        <span className="text-emerald-400 font-semibold text-xs tracking-widest uppercase">Tecnologia Feita para o Trânsito</span>
        <h2 className="text-3xl sm:text-4xl font-medium text-white tracking-[-0.03em]">
          Tudo o que você precisa para dominar suas finanças
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
          Desenvolvido com base no dia a dia de centenas de motoristas para eliminar o estresse financeiro.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {bentoCards.map((card) => (
          <motion.div
            key={card.title}
            className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between group"
            variants={reveal}
          >
            <div className="flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                  {card.secondIcon && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.secondIcon} />}
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white tracking-tight">{card.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{card.description}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.04] text-xs text-emerald-400 font-medium">
              {card.cta}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function AuthScreen({
  mode,
  setMode,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  isLoading,
  message,
  successMessage,
  onSubmit,
  onForgotPassword,
}: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<"visao" | "custos" | "metas">("visao");

  return (
    <MotionConfig reducedMotion="user">
    <div className="lux relative min-h-screen w-full selection:bg-emerald-500/20 selection:text-emerald-300 overflow-x-hidden">
      <AmbientBackground />

      <div className="relative z-10 flex flex-col w-full">
        {/* ── Top Header / Navbar ── */}
        <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_var(--color-lux-glow)]">
              <span className="text-emerald-400 font-bold text-sm tracking-tighter">GC</span>
            </div>
            <span className="font-semibold text-lg text-white tracking-tight">GanhoCerto</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              FINTECH PARA MOTORISTAS
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-transparent hover:border-white/[0.08] cursor-pointer"
            >
              {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
            </button>
          </div>
        </header>

        {/* ── Hero / Auth Split Section ── */}
        <motion.section
          className="w-full max-w-7xl mx-auto px-6 pt-10 pb-20 lg:pt-16 lg:pb-32 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-x-16 lg:gap-y-8 items-center"
          initial="hidden"
          animate="visible"
          variants={stagger(0.12, 0.1)}
        >
          {/* Proposta de valor */}
          <motion.div className="lg:col-span-7 flex flex-col gap-4" variants={stagger(0.15, 0)}>
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-zinc-300 text-xs font-medium w-fit"
              variants={reveal}
            >
              <span className="text-emerald-400">●</span> Uber · 99 · inDrive · Entregas
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-[-0.04em] text-white leading-[1.1] text-balance"
              variants={reveal}
            >
              Faturar é fácil. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300">
                Lucrar de verdade
              </span>{" "}
              é o que importa.
            </motion.h1>

            <motion.p
              className="text-zinc-400 text-base sm:text-lg font-normal leading-relaxed max-w-xl text-pretty"
              variants={reveal}
            >
              Chega de se iludir com faturamento bruto. O GanhoCerto calcula automaticamente o combustível, o desgaste de pneus, manutenção e impostos para você saber seu lucro real por hora e por km.
            </motion.p>
          </motion.div>

          {/* Formulário: logo após o título no celular, coluna direita no desktop */}
          <motion.div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 flex justify-center" variants={reveal}>
            <div className="w-full max-w-[420px] rounded-2xl bg-zinc-950/90 border border-white/[0.08] p-6 sm:p-8 shadow-2xl lg:backdrop-blur-2xl">
              
              {/* Tab Selector */}
              <div className="grid grid-cols-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl mb-6" role="group" aria-label="Tipo de acesso">
                {([["login", "Entrar"], ["register", "Criar conta"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={mode === key}
                    onClick={() => setMode(key)}
                    className={`relative py-2 text-xs sm:text-sm font-medium rounded-lg cursor-pointer transition-colors duration-200 ${
                      mode === key ? "text-black font-semibold" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {mode === key && (
                      <motion.span
                        layoutId="auth-tab-indicator"
                        className="absolute inset-0 rounded-lg bg-white shadow-md"
                        transition={spring.snappy}
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                ))}
              </div>

              {/* Form Title */}
              <div className="mb-6">
                <h2 className="text-xl font-medium text-white tracking-tight">
                  {mode === "login" ? "Acesse sua conta" : "Comece gratuitamente"}
                </h2>
                <p className="text-zinc-400 text-xs mt-1">
                  {mode === "login" ? "Digite suas credenciais para continuar." : "Leva menos de 1 minuto. Sem cartão."}
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                {mode === "register" && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name">
                      Nome completo
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Carlos Silva"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email">
                    E-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password">
                      Senha
                    </label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={mode === "login" ? 1 : 6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                {message && <FeedbackMessage kind="error">{message}</FeedbackMessage>}
                {successMessage && <FeedbackMessage kind="success">{successMessage}</FeedbackMessage>}

                {/* Primary CTA Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-[0.98] text-black font-semibold text-sm transition-all duration-200 shadow-[0_0_25px_var(--color-glass-border-hover)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === "login" ? "Entrar na plataforma" : "Criar minha conta gratuita"}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>

                <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-zinc-500 text-sm">
                  {["100% gratuito", "Sem cartão de crédito", "Seus dados seguros"].map((item) => (
                    <li key={item} className="whitespace-nowrap">
                      <span aria-hidden="true" className="text-emerald-400">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </form>
            </div>
          </motion.div>

          {/* Mockup Interativo do Painel GanhoCerto */}
          <motion.div
            variants={reveal}
            className="lg:col-span-7 lg:col-start-1 lg:row-start-2 w-full rounded-2xl bg-zinc-950/80 border border-white/[0.08] p-6 shadow-[0_20px_50px_var(--color-glass-shadow)] lg:backdrop-blur-xl relative overflow-hidden"
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
        </motion.section>

        {/* ── Bento Grid Section: Recursos Essenciais ── */}
        <section className="w-full bg-(--color-lux-void) py-24 px-6 border-t border-white/[0.04]">
          <BentoGridSection />
        </section>

        {/* ── Depoimentos Reais ── */}
        <section className="w-full bg-(--color-lux-canvas) py-20 px-6 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto flex flex-col gap-12">
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-medium text-white tracking-tight">
                Quem usa não volta para planilhas de papel
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  "Eu achava que lucrava R$ 5.500 no mês. Quando coloquei os custos de manutenção no GanhoCerto, vi que meu lucro real era R$ 3.800. Mudei os horários que rodava e agora tiro R$ 6.200 limpos."
                </p>
                <div>
                  <strong className="text-white text-xs block font-semibold">Carlos Eduardo</strong>
                  <span className="text-zinc-500 text-sm">Motorista Uber Black · São Paulo</span>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  "A melhor coisa é a meta diária. Eu sei a hora exata de parar e voltar para casa sem ficar rodando à toa gastando gasolina de madrugada."
                </p>
                <div>
                  <strong className="text-white text-xs block font-semibold">Juliana Mendes</strong>
                  <span className="text-zinc-500 text-sm">Motorista 99 · Belo Horizonte</span>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                  "Simples, direto e rápido de preencher pelo celular quando paro no posto para abastecer. Não precisa entender nada de contabilidade."
                </p>
                <div>
                  <strong className="text-white text-xs block font-semibold">Rodrigo Fontes</strong>
                  <span className="text-zinc-500 text-sm">Motorista Confort · Rio de Janeiro</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Call To Action Final ── */}
        <section className="w-full bg-(--color-lux-void) py-24 px-6 border-t border-white/[0.04]">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
            <h2 className="text-3xl sm:text-5xl font-medium text-white tracking-[-0.03em] leading-tight">
              Pronto para ter o controle total do seu volante?
            </h2>
            <p className="text-zinc-400 text-base max-w-lg">
              Cadastre-se gratuitamente em segundos e veja exatamente quanto sobra no seu bolso hoje.
            </p>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="py-3.5 px-8 rounded-xl bg-white hover:bg-zinc-200 active:scale-[0.98] text-black font-semibold text-sm transition-all shadow-[0_0_35px_var(--color-glass-border-hover)] flex items-center gap-2 cursor-pointer mt-2"
            >
              Começar agora gratuitamente
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="w-full py-8 px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-zinc-600 text-xs border-t border-white/[0.04] gap-4">
          <div>GanhoCerto © 2026. Todos os direitos reservados.</div>
          <div className="flex gap-6">
            <span>Privacidade</span>
            <span>Termos de Uso</span>
            <span>Suporte</span>
          </div>
        </footer>
      </div>
    </div>
    </MotionConfig>
  );
}
