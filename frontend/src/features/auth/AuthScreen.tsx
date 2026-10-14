import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { motion, MotionConfig, useScroll } from "framer-motion";
import { FeedbackMessage } from "../../components/FeedbackMessage";
import { GlowCard } from "../../components/GlowCard";
import { RollText } from "../../components/RollText";
import { SUPPORT_EMAIL } from "../../utils/support";
import { AmbientBackground } from "./AmbientBackground";
import { BrandMark } from "./AuthShell";
import { BentoGrid } from "./BentoGrid";
import { FinalCta } from "./FinalCta";
import { IntroCurtain } from "./IntroCurtain";
import { readIntroState, shouldPlayIntro } from "./intro";
import { ProductCanvas } from "./ProductCanvas";
import { ScrollMarquee } from "./ScrollMarquee";
import { ScrollStory } from "./ScrollStory";
import { scrollToElement, scrollToTop, useSmoothScroll } from "./smoothScroll";
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

// Real moments of use, each backed by a feature in the app (no invented people or numbers).
const momentsOfUse = [
  {
    moment: "No posto",
    title: "Registre o gasto em segundos",
    text: "Abasteceu? Lance o valor pelo celular ali mesmo, sem planilha e sem conta de cabeça.",
  },
  {
    moment: "No fim do dia",
    title: "Veja quanto sobrou de verdade",
    text: "Faturamento menos combustível e despesas: o lucro real do dia, por hora e por km.",
  },
  {
    moment: "Na semana",
    title: "Saiba quanto falta para a meta",
    text: "Acompanhe a meta da semana, quanto falta e o ritmo necessário para fechar o período.",
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
  useSmoothScroll();
  const { scrollYProgress: pageProgress } = useScroll();
  const [isHeaderHidden, setIsHeaderHidden] = useHideOnScrollDown();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [nameFocusRequest, setNameFocusRequest] = useState(0);
  // The opening plays once per session; the hero waits for the curtain to start lifting.
  const [playsIntro] = useState(() => shouldPlayIntro(readIntroState()));
  const [isIntroPlaying, setIsIntroPlaying] = useState(playsIntro);
  const handleIntroReveal = useCallback(() => setIsIntroPlaying(false), []);

  // The closing CTA lands on the form with the cursor already in the first field.
  useEffect(() => {
    if (nameFocusRequest > 0) nameInputRef.current?.focus({ preventScroll: true });
  }, [nameFocusRequest]);

  return (
    <MotionConfig reducedMotion="user">
    <div className="lux relative min-h-screen w-full selection:bg-emerald-500/20 selection:text-emerald-300 overflow-x-clip">
      <AmbientBackground />
      {playsIntro ? <IntroCurtain onReveal={handleIntroReveal} /> : null}

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
                // The form sits below the headline: glide to it and put the cursor in the e-mail field.
                if (formRef.current) scrollToElement(formRef.current);
                emailInputRef.current?.focus({ preventScroll: true });
              }}
              className="link-draw text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition-colors py-1.5 cursor-pointer"
            >
              {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
            </button>
          </div>
          </div>
          {/* Reading progress: a hairline that fills with the page. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-emerald-500 via-emerald-300 to-teal-200"
            style={{ scaleX: pageProgress }}
          />
        </motion.header>

        {/* ── Hero / Auth Split Section ── */}
        <motion.section
          className="w-full max-w-7xl mx-auto px-6 pt-10 pb-20 lg:pt-14 lg:pb-32 grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_auto_1fr] gap-10 lg:gap-x-16 lg:gap-y-12 items-start"
          initial="hidden"
          animate={isIntroPlaying ? "hidden" : "visible"}
          variants={stagger(0.12, 0.1)}
        >
          {/* Proposta de valor: título editorial em largura total */}
          <motion.div className="lg:col-span-12 flex flex-col gap-6" variants={stagger(0.15, 0)}>
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-zinc-300 text-xs font-medium w-fit"
              variants={reveal}
            >
              <span className="text-emerald-400">●</span> Uber · 99 · inDrive · Entregas
            </motion.div>

            <motion.h1
              className="text-[2.6rem] sm:text-6xl md:text-7xl lg:text-8xl xl:text-[7.5rem] font-medium tracking-[-0.05em] text-white leading-[0.98]"
              variants={stagger(0.14, 0)}
            >
              <MaskLine>Faturar é fácil.</MaskLine>
              <MaskLine className="lg:pl-[12%]">
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300">
                    Lucrar de verdade
                  </span>
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[0.02em] h-[0.06em] origin-left rounded-full bg-emerald-400/60"
                    variants={underlineDraw}
                  />
                </span>
              </MaskLine>
              <MaskLine className="lg:text-right">é o que importa.</MaskLine>
            </motion.h1>
          </motion.div>

          <motion.p
            className="lg:col-span-7 lg:row-start-2 text-zinc-400 text-base sm:text-lg font-normal leading-relaxed max-w-xl text-pretty"
            variants={reveal}
          >
            Chega de se iludir com faturamento bruto. O GanhoCerto calcula automaticamente o combustível, o desgaste de pneus, manutenção e impostos para você saber seu lucro real por hora e por km.
          </motion.p>

          {/* Formulário: logo após o título no celular, coluna direita no desktop */}
          <motion.div className="lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:row-span-2 flex justify-center" variants={formSwing}>
            <div ref={formRef} className="w-full max-w-[420px] rounded-2xl bg-zinc-950/90 border border-white/[0.08] p-6 sm:p-8 shadow-2xl lg:backdrop-blur-2xl">
              
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
                      ref={nameInputRef}
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
                    ref={emailInputRef}
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
                        className="link-draw text-xs text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
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
                  className="group w-full mt-2 py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 active:scale-[0.98] text-black font-semibold text-sm transition-[background-color,transform] duration-200 shadow-[0_0_25px_var(--color-glass-border-hover)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <RollText>{mode === "login" ? "Entrar na plataforma" : "Criar minha conta gratuita"}</RollText>
                      <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>

                <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-zinc-500 text-sm">
                  {["Comece grátis", "Sem cartão de crédito", "Seus dados seguros"].map((item) => (
                    <li key={item} className="whitespace-nowrap">
                      <span aria-hidden="true" className="text-emerald-400">✓</span> {item}
                    </li>
                  ))}
                </ul>

                {mode === "register" ? (
                  <p className="text-center text-xs leading-relaxed text-zinc-500">
                    Ao criar a conta, você concorda com os{" "}
                    <a className="text-zinc-300 underline underline-offset-4 hover:text-white" href="/termos">Termos de Uso</a>{" "}
                    e a{" "}
                    <a className="text-zinc-300 underline underline-offset-4 hover:text-white" href="/privacidade">Política de Privacidade</a>.
                  </p>
                ) : null}
              </form>
            </div>
          </motion.div>

          <ProductCanvas className="lg:col-span-7 lg:col-start-1 lg:row-start-3" />
        </motion.section>

        {/* ── História no scroll: do faturamento ao lucro ── */}
        <ScrollStory />

        {/* ── Faixa de termos guiada pelo scroll ── */}
        <ScrollMarquee />

        {/* ── Bento Grid Section: Recursos Essenciais ── */}
        <section className="w-full bg-(--color-lux-void) py-24 px-6 border-t border-white/[0.04]">
          <BentoGrid />
        </section>

        {/* ── Momentos de uso ── */}
        <section className="w-full bg-(--color-lux-canvas) py-20 px-6 border-t border-white/[0.04]">
          <motion.div
            className="max-w-6xl mx-auto flex flex-col gap-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger(0.12, 0)}
          >
            <h2 className="text-center text-2xl sm:text-3xl font-medium text-white tracking-tight">
              <MaskLine>Feito para o dia a dia de quem dirige</MaskLine>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {momentsOfUse.map((item) => (
                <GlowCard
                  key={item.moment}
                  className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] transition-colors duration-300 flex flex-col gap-3"
                  variants={reveal}
                >
                  <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{item.moment}</span>
                  <h3 className="text-lg font-medium text-white tracking-tight">{item.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.text}</p>
                </GlowCard>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Call To Action Final ── */}
        <FinalCta
          onStart={() => {
            setMode("register");
            scrollToTop();
            setNameFocusRequest((request) => request + 1);
          }}
        />

        {/* ── Footer ── */}
        <footer className="w-full py-8 px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-zinc-600 text-xs border-t border-white/[0.04] gap-4">
          <div>GanhoCerto © 2026. Todos os direitos reservados.</div>
          <nav className="flex gap-6" aria-label="Institucional">
            <a className="link-draw text-zinc-600 hover:text-zinc-300 transition-colors" href="/privacidade">Privacidade</a>
            <a className="link-draw text-zinc-600 hover:text-zinc-300 transition-colors" href="/termos">Termos de Uso</a>
            {SUPPORT_EMAIL ? (
              <a className="link-draw text-zinc-600 hover:text-zinc-300 transition-colors" href={`mailto:${SUPPORT_EMAIL}`}>Suporte</a>
            ) : null}
          </nav>
        </footer>
      </div>
    </div>
    </MotionConfig>
  );
}
