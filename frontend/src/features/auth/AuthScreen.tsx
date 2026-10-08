import { FormEvent, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from "framer-motion";
import { FeedbackMessage } from "../../components/FeedbackMessage";
import { AnimatedBackground } from "./AnimatedBackground";

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

/* ── Spring Presets ── */
const spring = { type: "spring" as const, stiffness: 100, damping: 20, mass: 0.8 };
const springSnappy = { type: "spring" as const, stiffness: 300, damping: 30 };

/* ── Feature Data ── */
const features = [
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: "Gestão de Ganhos",
    desc: "Acompanhe suas corridas e entenda seu faturamento real, descontando automaticamente os gastos com combustível e manutenção.",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Análise de Desempenho",
    desc: "Métricas avançadas sobre quais horários, regiões e aplicativos trazem o maior retorno para o seu perfil e veículo.",
  },
  {
    icon: (
      <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "Segurança Financeira",
    desc: "Seus dados protegidos e sua independência financeira construída de forma inteligente, consistente e segura.",
  },
];

/* ── Reusable scroll-reveal wrapper ── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Animated line that draws on scroll ── */
function AnimatedDivider() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  return (
    <div ref={ref} className="w-full flex justify-center py-1">
      <motion.div
        className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        initial={{ width: "0%" }}
        animate={isInView ? { width: "100%" } : { width: "0%" }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}


export function AuthScreen({
  mode, setMode, name, setName, email, setEmail,
  password, setPassword, isLoading, message, successMessage,
  onSubmit, onForgotPassword,
}: AuthScreenProps) {

  /* ── Hero parallax ── */
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useSpring(useTransform(scrollYProgress, [0, 1], [0, 120]), { stiffness: 50, damping: 20 });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  /* ── Word-by-word animation for headline ── */
  const line1Words = "Faturar é o começo.".split(" ");
  const line2Words = "Lucrar é o destino.".split(" ");

  return (
    <div className="relative min-h-screen w-full bg-[#030303] text-zinc-300 selection:bg-emerald-500/20 selection:text-emerald-300 overflow-x-hidden"
         style={{ fontFamily: "var(--font-family)" }}>
      
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <AnimatedBackground />
      </div>

      <div className="relative z-10 flex flex-col w-full">

        {/* ═══════════════════════════════════════════
            HERO / AUTH SECTION
            ═══════════════════════════════════════════ */}
        <div ref={heroRef} className="flex flex-col lg:flex-row min-h-screen w-full relative">
          
          {/* LEFT — BRAND COPY with parallax */}
          <motion.div 
            className="flex-1 lg:flex-[1.1] flex flex-col justify-center px-8 py-12 lg:p-24 relative"
            style={{ y: heroY, opacity: heroOpacity }}
          >
            <div className="max-w-xl mx-auto lg:mx-0">
              
              {/* Logo */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="flex items-center gap-2.5 mb-16 lg:mb-24"
              >
                <motion.div 
                  className="w-5 h-5 rounded bg-emerald-500"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ ...springSnappy, delay: 0.2 }}
                />
                <span className="font-semibold text-white tracking-tight">GanhoCerto</span>
              </motion.div>
              
              {/* Headline — word by word */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 leading-[1.1] tracking-[-0.05em]">
                <span className="block mb-1">
                  {line1Words.map((word, i) => (
                    <motion.span
                      key={i}
                      className="inline-block mr-[0.3em]"
                      initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.6, delay: 0.3 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </span>
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600">
                  {line2Words.map((word, i) => (
                    <motion.span
                      key={i}
                      className="inline-block mr-[0.3em]"
                      initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.6, delay: 0.7 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </span>
              </h1>
              
              {/* Subheadline */}
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
                className="text-lg md:text-xl text-zinc-400 font-normal leading-relaxed max-w-lg tracking-[-0.01em]"
              >
                A plataforma financeira definitiva para profissionais independentes.
                Entenda seus custos reais e otimize sua margem em segundos.
              </motion.p>

              {/* Animated accent line under text */}
              <motion.div
                className="h-px mt-10 bg-gradient-to-r from-emerald-500/50 via-emerald-500/20 to-transparent"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "60%", opacity: 1 }}
                transition={{ duration: 1.2, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            
            {/* Scroll indicator */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 2, duration: 1 }}
              className="absolute bottom-10 left-8 lg:left-24 hidden md:flex items-center gap-2 text-zinc-600"
            >
              <motion.svg 
                className="w-4 h-4" 
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </motion.svg>
              <span className="text-xs font-medium uppercase tracking-widest">Descubra</span>
            </motion.div>
          </motion.div>

          {/* RIGHT — AUTH FORM */}
          <div className="flex-1 lg:flex-[0.9] flex items-center justify-center p-6 sm:p-12 lg:p-16">
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...spring, delay: 0.4 }}
              className="w-full max-w-[420px] bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl rounded-xl p-8 shadow-2xl"
            >
              {/* Tabs */}
              <div className="flex w-full mb-8 bg-black/40 rounded-lg p-1 border border-white/[0.04]">
                {(['login', 'register'] as AuthMode[]).map((tab) => (
                  <button key={tab} type="button"
                    onClick={() => setMode(tab)}
                    className="relative flex-1 py-2.5 text-sm font-medium rounded-md transition-colors cursor-pointer"
                  >
                    <span className={`relative z-10 transition-colors duration-200 ${mode === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      {tab === 'login' ? 'Entrar' : 'Criar conta'}
                    </span>
                    {mode === tab && (
                      <motion.div 
                        layoutId="auth-tab" 
                        className="absolute inset-0 bg-white/[0.08] rounded-md border border-white/[0.06]" 
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} 
                      />
                    )}
                  </button>
                ))}
              </div>

              <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                {/* Form title */}
                <div className="mb-1">
                  <AnimatePresence mode="wait">
                    <motion.h2 key={mode}
                      initial={{ opacity: 0, x: -12 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="text-xl font-medium text-white tracking-[-0.03em]"
                    >
                      {mode === "login" ? "Acesse sua conta" : "Comece gratuitamente"}
                    </motion.h2>
                  </AnimatePresence>
                </div>

                {/* Name field (register only) */}
                <AnimatePresence initial={false}>
                  {mode === "register" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: "auto" }} 
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="flex flex-col gap-1.5 overflow-hidden"
                    >
                      <label className="text-sm font-medium text-zinc-400" htmlFor="name">Nome</label>
                      <input id="name" type="text" name="name" required value={name} onChange={(e) => setName(e.target.value)}
                        className="input-glass" placeholder="Seu nome completo" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <motion.div 
                  className="flex flex-col gap-1.5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  <label className="text-sm font-medium text-zinc-400" htmlFor="email">Email</label>
                  <input id="email" type="email" name="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input-glass" placeholder="voce@exemplo.com" />
                </motion.div>

                {/* Password */}
                <motion.div 
                  className="flex flex-col gap-1.5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-400" htmlFor="password">Senha</label>
                    {mode === "login" && (
                      <button type="button" onClick={onForgotPassword} className="text-xs font-medium text-zinc-500 hover:text-white transition-colors cursor-pointer">
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <input id="password" type="password" name="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    minLength={mode === "login" ? 1 : 6}
                    className="input-glass" placeholder="••••••••" />
                </motion.div>

                {/* Feedback messages */}
                <AnimatePresence>
                  {message && (
                    <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }}>
                      <FeedbackMessage kind="error">{message}</FeedbackMessage>
                    </motion.div>
                  )}
                  {successMessage && (
                    <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -8, height: 0 }}>
                      <FeedbackMessage kind="success">{successMessage}</FeedbackMessage>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button */}
                <motion.button type="submit" disabled={isLoading}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                  whileHover={{ scale: 1.015, boxShadow: "0 8px 30px rgba(255,255,255,0.12)" }} 
                  whileTap={{ scale: 0.97 }}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-white text-black font-medium py-3 rounded-lg transition-shadow disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <motion.div 
                      className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                  ) : (
                    <>
                      {mode === "login" ? "Entrar" : "Criar conta"}
                      <motion.svg 
                        className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        initial={{ x: 0 }}
                        whileHover={{ x: 3 }}
                        transition={springSnappy}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </motion.svg>
                    </>
                  )}
                </motion.button>

                {/* Trust signals */}
                <motion.div 
                  className="flex items-center justify-center gap-4 mt-2 text-zinc-600 text-xs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.6 }}
                >
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Sem cartão
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Cancele quando quiser
                  </span>
                </motion.div>
              </form>
            </motion.div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            FEATURES SECTION
            ═══════════════════════════════════════════ */}
        <AnimatedDivider />
        
        <div className="w-full bg-[#000000] py-24 px-6 md:px-12">
          <div className="max-w-6xl mx-auto">
            {/* Section header */}
            <Reveal className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-medium text-white mb-4 tracking-[-0.04em]">
                Controle total da sua operação
              </h2>
              <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
                Ferramentas precisas para transformar dados em decisões financeiras inteligentes.
              </p>
            </Reveal>
            
            {/* Feature cards with stagger */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {features.map((feature, i) => (
                <Reveal key={i} delay={i * 0.15}>
                  <motion.div
                    className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-8 h-full transition-all duration-300 group"
                    whileHover={{ 
                      borderColor: "rgba(255,255,255,0.15)",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      y: -4,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div 
                      className="mb-6 w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"
                      whileHover={{ scale: 1.1, backgroundColor: "rgba(16,185,129,0.15)" }}
                      transition={springSnappy}
                    >
                      {feature.icon}
                    </motion.div>
                    <h3 className="text-lg font-medium text-white mb-3 tracking-tight">{feature.title}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            FINAL CTA
            ═══════════════════════════════════════════ */}
        <AnimatedDivider />

        <div className="w-full bg-[#030303] py-32 px-6">
          <Reveal className="max-w-3xl mx-auto text-center flex flex-col items-center">
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-xs font-medium mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <motion.span 
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              Comece agora — é gratuito
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-medium text-white mb-6 tracking-[-0.04em] leading-tight">
              A clareza financeira{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600">
                que você merece.
              </span>
            </h2>
            <p className="text-zinc-400 text-lg mb-10 max-w-xl">
              Deixe as planilhas para trás. Obtenha insights instantâneos sobre sua rentabilidade e tome decisões melhores.
            </p>
            <motion.button
              onClick={() => { setMode("register"); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(255,255,255,0.15)" }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2.5 bg-white text-black px-8 py-3.5 rounded-lg font-medium shadow-lg transition-shadow cursor-pointer"
            >
              Criar conta gratuitamente
              <motion.svg 
                className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                whileHover={{ x: 4 }}
                transition={springSnappy}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </motion.svg>
            </motion.button>
          </Reveal>
        </div>
        
        {/* FOOTER */}
        <AnimatedDivider />
        <footer className="w-full py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between text-zinc-600 text-xs">
          <div>GanhoCerto © 2026. Todos os direitos reservados.</div>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Termos</a>
          </div>
        </footer>
      </div>
    </div>
  );
}
