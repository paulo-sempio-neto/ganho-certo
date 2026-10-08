import { FormEvent } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { FeedbackMessage } from "../../components/FeedbackMessage";
import { AnimatedBackground } from "./AnimatedBackground";
import { CustomCursor } from "../../components/CustomCursor";
import { PremiumCTA } from "../../components/PremiumCTA";
import { MagneticButton } from "../../components/MagneticButton";
import { GlowCard } from "../../components/GlowCard";
import { ScrollReveal } from "../../components/ScrollReveal";

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

// ─── Spring Presets ───────────────────────────
const SPRING = {
  magnetic: { type: "spring" as const, stiffness: 150, damping: 15, mass: 0.1 },
  button: { type: "spring" as const, stiffness: 400, damping: 17, mass: 0.8 },
  ui: { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.5 },
  card: { type: "spring" as const, stiffness: 100, damping: 22, mass: 0.9 },
};

// ─── Feature Data ────────────────────────────
const features = [
  {
    icon: (
      <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: "Gestão de Ganhos",
    desc: "Acompanhe suas corridas e entenda seu faturamento real, descontando automaticamente os gastos com combustível e manutenção.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Análise de Desempenho",
    desc: "Métricas avançadas sobre quais horários, regiões e aplicativos trazem o maior retorno para o seu perfil e veículo.",
  },
  {
    icon: (
      <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "Segurança Financeira",
    desc: "Seus dados protegidos e sua independência financeira construída de forma inteligente, consistente e segura.",
  },
];

export function AuthScreen({
  mode, setMode, name, setName, email, setEmail,
  password, setPassword, isLoading, message, successMessage,
  onSubmit, onForgotPassword,
}: AuthScreenProps) {

  const introVariants: Variants = {
    hidden: { opacity: 0, x: -40 },
    visible: { 
      opacity: 1, x: 0, 
      transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.2 } 
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 25, filter: "blur(6px)" },
    visible: { 
      opacity: 1, y: 0, filter: "blur(0px)",
      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } 
    },
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050505] text-gray-100 selection:bg-green-500/30 selection:text-green-200"
         style={{ fontFamily: "var(--font-family)" }}>
      <CustomCursor />
      
      {/* ── FULL SCREEN FLUID BACKGROUND ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatedBackground />
        <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-transparent via-transparent lg:via-[#050505]/20 to-[#050505]/80 pointer-events-none" />
      </div>

      {/* ── CONTENT ── */}
      <div className="relative z-10 flex flex-col w-full">
        
        {/* ════════════════════════════════════
            HERO / AUTH SECTION
            ════════════════════════════════════ */}
        <div className="flex flex-col lg:flex-row min-h-screen w-full relative">
          
          {/* LEFT — BRANDING */}
          <motion.div 
            className="relative flex-1 lg:flex-[1.2] flex flex-col justify-center px-8 py-16 lg:p-20"
            initial="hidden" animate="visible" variants={introVariants}
          >
            <div className="relative z-10 max-w-2xl mx-auto lg:mx-0">
              
              {/* Eyebrow brand pill */}
              <motion.div variants={itemVariants} className="eyebrow-premium mb-12 lg:mb-[18vh]">
                <span className="pulse-dot" />
                GanhoCerto
              </motion.div>
              
              {/* Cinematic Headline */}
              <h1 className="headline-cinematic mb-8 drop-shadow-lg" style={{ perspective: "1000px" }}>
                <motion.span 
                  initial="hidden" animate="visible"
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.025, delayChildren: 0.15 } } }}
                  className="block text-white mb-3"
                >
                  {"Faturar é o começo.".split("").map((char, i) => (
                    <motion.span key={i}
                      variants={{
                        hidden: { opacity: 0, y: 60, rotateX: -90, filter: "blur(12px)" },
                        visible: { opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } }
                      }}
                      className="inline-block" style={{ transformOrigin: "bottom" }}
                    >
                      {char === " " ? "\u00A0" : char}
                    </motion.span>
                  ))}
                </motion.span>
                <motion.span 
                  initial="hidden" animate="visible"
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.7 } } }}
                  className="block text-gradient-premium pb-2"
                >
                  {"Lucrar é o destino.".split("").map((char, i) => (
                    <motion.span key={i}
                      variants={{
                        hidden: { opacity: 0, y: 50, scale: 0.7, filter: "blur(12px)" },
                        visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] } }
                      }}
                      className="inline-block"
                    >
                      {char === " " ? "\u00A0" : char}
                    </motion.span>
                  ))}
                </motion.span>
              </h1>
              
              <motion.p variants={itemVariants} className="text-lg sm:text-xl text-gray-400 font-medium leading-relaxed max-w-xl">
                Enquanto você calcula no achômetro, seus custos reais estão{" "}
                <span className="text-emerald-400 font-semibold">corroendo seu lucro</span>. 
                Descubra sua margem real em segundos.
              </motion.p>
            </div>
          </motion.div>

          {/* RIGHT — GLASS FORM */}
          <motion.div 
            className="relative z-20 flex-1 lg:flex-[0.8] flex items-center justify-center p-6 sm:p-10 lg:p-16"
            initial={{ opacity: 0, x: 50, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          >
            <div className="glass-premium w-full max-w-[440px] p-8 sm:p-10">
              <div className="relative z-10">
                
                {/* Genuine value proposition instead of fake social proof */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="flex items-center justify-center gap-3 mb-8 py-3 px-4 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15"
                >
                  <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs text-emerald-300/80 font-medium">
                    A ferramenta definitiva para motoristas e entregadores
                  </span>
                </motion.div>

                {/* Tabs */}
                <div className="tabs-glass mb-8" role="group">
                  <button type="button"
                    className={`relative py-3 px-4 text-sm font-semibold rounded-xl transition-colors duration-200 ${mode === "login" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                    onClick={() => setMode("login")} aria-pressed={mode === "login"}
                  >
                    <span className="relative z-10">Entrar</span>
                    {mode === "login" && (
                      <motion.div className="absolute inset-0 bg-white/[0.08] rounded-xl border border-white/10" layoutId="tab-indicator" transition={SPRING.ui} />
                    )}
                  </button>
                  <button type="button"
                    className={`relative py-3 px-4 text-sm font-semibold rounded-xl transition-colors duration-200 ${mode === "register" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                    onClick={() => setMode("register")} aria-pressed={mode === "register"}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Criar conta
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">Grátis</span>
                    </span>
                    {mode === "register" && (
                      <motion.div className="absolute inset-0 bg-white/[0.08] rounded-xl border border-white/10" layoutId="tab-indicator" transition={SPRING.ui} />
                    )}
                  </button>
                </div>

                {/* Form */}
                <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                  <AnimatePresence mode="wait">
                    <motion.h2 key={mode}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-2xl font-bold text-white tracking-tight mb-1"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {mode === "login" ? "Bem-vindo de volta" : "Comece a lucrar agora"}
                    </motion.h2>
                  </AnimatePresence>

                  <AnimatePresence>
                    {mode === "register" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        animate={{ opacity: 1, height: 'auto', overflow: 'visible' }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="flex flex-col gap-2"
                      >
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider" htmlFor="auth-name">Nome completo</label>
                        <input id="auth-name" className="input-glass" placeholder="João Silva"
                          autoComplete="name" name="name" type="text" required
                          value={name} onChange={(e) => setName(e.target.value)} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider" htmlFor="auth-email">E-mail</label>
                    <input id="auth-email" className="input-glass" placeholder="seu@email.com"
                      autoComplete="email" name="email" type="email" required
                      value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider" htmlFor="auth-password">Senha</label>
                      {mode === "login" && (
                        <button type="button"
                          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                          onClick={onForgotPassword}
                        >Esqueceu?</button>
                      )}
                    </div>
                    <input id="auth-password" className="input-glass" placeholder="••••••••"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      minLength={mode === "login" ? 1 : 6}
                      name="password" type="password" required
                      value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>

                  <AnimatePresence>
                    {message && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                        <FeedbackMessage kind="error">{message}</FeedbackMessage>
                      </motion.div>
                    )}
                    {successMessage && (
                      <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                        <FeedbackMessage kind="success">{successMessage}</FeedbackMessage>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <PremiumCTA type="submit" disabled={isLoading}>
                    {isLoading ? "Processando..." : mode === "login" ? "Entrar na plataforma" : "Criar minha conta grátis"}
                  </PremiumCTA>
                </form>

                {/* Risk reversal */}
                <div className="flex flex-col items-center gap-3 mt-5">
                  <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Sem cartão de crédito</span>
                    <span className="text-gray-700">·</span>
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Cancele quando quiser</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <div className="absolute bottom-0 left-0 w-full h-32 md:h-56 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent z-30 pointer-events-none flex flex-col justify-end items-center pb-6 md:pb-10">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5, duration: 1 }}
              className="hidden md:flex flex-col items-center gap-3">
              <span className="text-gray-500/80 text-[10px] font-bold tracking-[0.3em] uppercase">Deslize</span>
              <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-6 h-10 border-2 border-gray-700/50 rounded-full flex justify-center p-1.5 bg-[#050505]/30 backdrop-blur-sm">
                <div className="w-1 h-2 bg-green-500/80 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* ════════════════════════════════════
            FEATURES SECTION (with GlowCards)
            ════════════════════════════════════ */}
        <div className="w-full bg-[#050505] pt-16 pb-24 md:pt-20 md:pb-32 px-6 md:px-8 relative z-30">
          <div className="max-w-7xl w-full mx-auto">
            <ScrollReveal className="text-center mb-16 md:mb-24">
              <h2 className="headline-section text-white mb-6">
                Por que escolher o <span className="text-gradient-premium">GanhoCerto</span>?
              </h2>
              <p className="text-gray-400 text-base md:text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
                A única plataforma que transforma as incertezas de motoristas e entregadores em dados precisos para o crescimento real.
              </p>
            </ScrollReveal>
            
            <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 } } }}
            >
              {features.map((feature, i) => (
                <motion.div key={i}
                  variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } } }}
                >
                  <GlowCard className={`p-8 md:p-10 flex flex-col h-full ${i === 2 ? "md:col-span-2 lg:col-span-1" : ""}`}>
                    <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-8 border border-green-500/20 group-hover:scale-110 group-hover:bg-green-500/20 transition-all duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-4">{feature.title}</h3>
                    <p className="text-gray-400 leading-relaxed font-medium text-sm md:text-base flex-grow">{feature.desc}</p>
                  </GlowCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ════════════════════════════════════
            FINAL CTA — THE CLOSER
            ════════════════════════════════════ */}
        <div className="max-w-5xl w-full mx-auto mt-16 md:mt-24 mb-20 px-6 relative bg-[#050505]">
          <div className="absolute inset-0 bg-emerald-500/[0.06] blur-[120px] rounded-full pointer-events-none" />
          <ScrollReveal>
            <div className="glass-premium p-10 md:p-20 text-center">
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none rounded-[inherit]"
                style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-8">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  O controle financeiro que faltava na sua rotina
                </div>
                <h2 className="headline-section text-white mb-6">
                  Pronto para descobrir<br className="hidden md:block" />
                  <span className="text-gradient-premium"> seu lucro real?</span>
                </h2>
                <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
                  Comece agora a calcular seus ganhos com precisão e tome decisões financeiras mais inteligentes.
                </p>
                <MagneticButton
                  onClick={() => { setMode("register"); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  strength={0.2}
                  className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-white text-black font-semibold text-lg md:text-xl shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:bg-gray-50 transition-all duration-300 cursor-pointer"
                >
                  Criar minha conta grátis
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </MagneticButton>
                <p className="text-gray-600 text-xs mt-6">
                  Setup rápido · Sem cartão de crédito · Cancele a qualquer momento
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
        
        {/* FOOTER */}
        <footer className="w-full border-t border-gray-900 mt-20 pt-10 pb-10 px-6 flex flex-col md:flex-row items-center justify-between text-gray-600 text-sm bg-[#050505]">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-bold tracking-widest uppercase">GanhoCerto © 2026</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
            <a href="#" className="hover:text-white transition-colors">Contato</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
