import { FormEvent } from "react";
import { motion, MotionConfig } from "framer-motion";
import { FeedbackMessage } from "../../components/FeedbackMessage";
import { GlowCard } from "../../components/GlowCard";
import { AmbientBackground } from "./AmbientBackground";
import { BrandMark } from "./AuthShell";
import { BentoGrid } from "./BentoGrid";
import { ProductCanvas } from "./ProductCanvas";
import { ScrollStory } from "./ScrollStory";
import { useHideOnScrollDown } from "./useHideOnScrollDown";
import { MaskLine } from "./MaskLine";
import { reveal, spring, stagger, tiltIn, underlineDraw } from "./motion";

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

const formSwing = tiltIn("y", -16);

const testimonials = [
  {
    quote: "Eu achava que lucrava R$ 5.500 no mês. Quando coloquei os custos de manutenção no GanhoCerto, vi que meu lucro real era R$ 3.800. Mudei os horários que rodava e agora tiro R$ 6.200 limpos.",
    name: "Carlos Eduardo",
    role: "Motorista Uber Black · São Paulo",
  },
  {
    quote: "A melhor coisa é a meta diária. Eu sei a hora exata de parar e voltar para casa sem ficar rodando à toa gastando gasolina de madrugada.",
    name: "Juliana Mendes",
    role: "Motorista 99 · Belo Horizonte",
  },
  {
    quote: "Simples, direto e rápido de preencher pelo celular quando paro no posto para abastecer. Não precisa entender nada de contabilidade.",
    name: "Rodrigo Fontes",
    role: "Motorista Confort · Rio de Janeiro",
  },
];

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
  const [isHeaderHidden, setIsHeaderHidden] = useHideOnScrollDown();

  return (
    <MotionConfig reducedMotion="user">
    <div className="lux relative min-h-screen w-full selection:bg-emerald-500/20 selection:text-emerald-300 overflow-x-clip">
      <AmbientBackground />

      <div className="relative z-10 flex flex-col w-full">
        {/* ── Top Header / Navbar ── */}
        <motion.header
          className="sticky top-0 z-50 w-full border-b border-white/[0.04] bg-(--color-lux-canvas)/80 lg:backdrop-blur-xl"
          animate={{ y: isHeaderHidden ? "-100%" : "0%" }}
          transition={spring.snappy}
          onFocusCapture={() => setIsHeaderHidden(false)}
        >
          <div className="w-full max-w-7xl mx-auto px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
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
          </div>
        </motion.header>

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
              variants={stagger(0.14, 0)}
            >
              <MaskLine>Faturar é fácil.</MaskLine>
              <MaskLine>
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300">
                    Lucrar de verdade
                  </span>
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[0.02em] h-[0.06em] origin-left rounded-full bg-emerald-400/60"
                    variants={underlineDraw}
                  />
                </span>{" "}
                é o que importa.
              </MaskLine>
            </motion.h1>

            <motion.p
              className="text-zinc-400 text-base sm:text-lg font-normal leading-relaxed max-w-xl text-pretty"
              variants={reveal}
            >
              Chega de se iludir com faturamento bruto. O GanhoCerto calcula automaticamente o combustível, o desgaste de pneus, manutenção e impostos para você saber seu lucro real por hora e por km.
            </motion.p>
          </motion.div>

          {/* Formulário: logo após o título no celular, coluna direita no desktop */}
          <motion.div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 flex justify-center" variants={formSwing}>
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

          <ProductCanvas className="lg:col-span-7 lg:col-start-1 lg:row-start-2" />
        </motion.section>

        {/* ── História no scroll: do faturamento ao lucro ── */}
        <ScrollStory />

        {/* ── Bento Grid Section: Recursos Essenciais ── */}
        <section className="w-full bg-(--color-lux-void) py-24 px-6 border-t border-white/[0.04]">
          <BentoGrid />
        </section>

        {/* ── Depoimentos Reais ── */}
        <section className="w-full bg-(--color-lux-canvas) py-20 px-6 border-t border-white/[0.04]">
          <motion.div
            className="max-w-6xl mx-auto flex flex-col gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger(0.12, 0)}
          >
            <h2 className="text-center text-2xl sm:text-3xl font-medium text-white tracking-tight">
              <MaskLine>Quem usa não volta para planilhas de papel</MaskLine>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((testimonial) => (
                <GlowCard
                  key={testimonial.name}
                  className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] transition-colors duration-300 flex flex-col justify-between"
                  variants={reveal}
                >
                  <p className="text-zinc-300 text-sm leading-relaxed mb-6">“{testimonial.quote}”</p>
                  <div>
                    <strong className="text-white text-xs block font-semibold">{testimonial.name}</strong>
                    <span className="text-zinc-500 text-sm">{testimonial.role}</span>
                  </div>
                </GlowCard>
              ))}
            </div>
          </motion.div>
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
