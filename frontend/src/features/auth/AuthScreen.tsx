import { FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const features = [
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: "Gestão de Ganhos",
    desc: "Acompanhe suas corridas e entenda seu faturamento real, descontando automaticamente os gastos com combustível e manutenção.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Análise de Desempenho",
    desc: "Métricas avançadas sobre quais horários, regiões e aplicativos trazem o maior retorno para o seu perfil e veículo.",
  },
  {
    icon: (
      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.1, delayChildren: 0.1 } 
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <div className="relative min-h-screen w-full bg-[#030303] text-zinc-300 selection:bg-emerald-500/20 selection:text-emerald-300"
         style={{ fontFamily: "var(--font-family)" }}>
      
      {/* Background Component */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <AnimatedBackground />
      </div>

      <div className="relative z-10 flex flex-col w-full">
        {/* HERO / AUTH SECTION */}
        <div className="flex flex-col lg:flex-row min-h-screen w-full">
          
          {/* LEFT — BRAND COPY */}
          <div className="flex-1 lg:flex-[1.1] flex flex-col justify-center px-8 py-12 lg:p-24 relative">
            <motion.div 
              className="max-w-xl mx-auto lg:mx-0"
              initial="hidden" animate="visible" variants={containerVariants}
            >
              <motion.div variants={itemVariants} className="flex items-center gap-2.5 mb-16 lg:mb-24">
                <div className="w-5 h-5 rounded bg-emerald-500" />
                <span className="font-semibold text-white tracking-tight">GanhoCerto</span>
              </motion.div>
              
              <motion.h1 variants={itemVariants} className="text-4xl md:text-5xl lg:text-6xl font-medium text-white mb-6 leading-[1.1] tracking-[-0.05em]">
                Faturar é o começo. <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-emerald-600">Lucrar é o destino.</span>
              </motion.h1>
              
              <motion.p variants={itemVariants} className="text-lg md:text-xl text-zinc-400 font-normal leading-relaxed max-w-lg tracking-[-0.01em]">
                A plataforma financeira definitiva para profissionais independentes.
                Entenda seus custos reais e otimize sua margem em segundos.
              </motion.p>
            </motion.div>
            
            {/* Subtle scroll indicator */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }}
              className="absolute bottom-10 left-8 lg:left-24 hidden md:flex items-center gap-2 text-zinc-600"
            >
              <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-xs font-medium uppercase tracking-widest">Descubra</span>
            </motion.div>
          </div>

          {/* RIGHT — AUTH FORM */}
          <div className="flex-1 lg:flex-[0.9] flex items-center justify-center p-6 sm:p-12 lg:p-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              className="w-full max-w-[420px] bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl rounded-xl p-8 shadow-2xl"
            >
              {/* Tabs */}
              <div className="flex w-full mb-8 bg-black/40 rounded-lg p-1 border border-white/[0.04]">
                {(['login', 'register'] as AuthMode[]).map((tab) => (
                  <button key={tab} type="button"
                    onClick={() => setMode(tab)}
                    className="relative flex-1 py-2 text-sm font-medium rounded-md transition-colors"
                  >
                    <span className={`relative z-10 ${mode === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      {tab === 'login' ? 'Entrar' : 'Criar conta'}
                    </span>
                    {mode === tab && (
                      <motion.div layoutId="auth-tab" className="absolute inset-0 bg-white/[0.08] rounded-md shadow-sm border border-white/[0.04]" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
                    )}
                  </button>
                ))}
              </div>

              <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                <div className="mb-2">
                  <AnimatePresence mode="wait">
                    <motion.h2 key={mode}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                      className="text-xl font-medium text-white tracking-[-0.03em]"
                    >
                      {mode === "login" ? "Acesse sua conta" : "Comece gratuitamente"}
                    </motion.h2>
                  </AnimatePresence>
                </div>

                <AnimatePresence initial={false}>
                  {mode === "register" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="flex flex-col gap-1.5 overflow-hidden"
                    >
                      <label className="text-sm font-medium text-zinc-400" htmlFor="name">Nome</label>
                      <input id="name" type="text" name="name" required value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                        placeholder="Seu nome completo" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-400" htmlFor="email">Email</label>
                  <input id="email" type="email" name="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                    placeholder="voce@exemplo.com" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-zinc-400" htmlFor="password">Senha</label>
                    {mode === "login" && (
                      <button type="button" onClick={onForgotPassword} className="text-xs font-medium text-zinc-500 hover:text-white transition-colors">
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <input id="password" type="password" name="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                    minLength={mode === "login" ? 1 : 6}
                    className="w-full bg-black/50 border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                    placeholder="••••••••" />
                </div>

                <AnimatePresence>
                  {message && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <FeedbackMessage kind="error">{message}</FeedbackMessage>
                    </motion.div>
                  )}
                  {successMessage && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <FeedbackMessage kind="success">{successMessage}</FeedbackMessage>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button type="submit" disabled={isLoading}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-white text-black font-medium py-3 rounded-lg hover:shadow-[0_4px_12px_rgba(255,255,255,0.1)] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
                  {!isLoading && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7-7m7-7H3" />
                    </svg>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </div>
        </div>

        {/* FEATURES SECTION */}
        <div className="w-full bg-[#000000] py-24 px-6 md:px-12 border-t border-white/[0.04]">
          <div className="max-w-6xl mx-auto">
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={containerVariants}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8"
            >
              {features.map((feature, i) => (
                <motion.div key={i} variants={itemVariants}
                  className="bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors duration-300 rounded-xl p-8"
                >
                  <div className="mb-6">{feature.icon}</div>
                  <h3 className="text-lg font-medium text-white mb-3 tracking-tight">{feature.title}</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* FINAL CTA SECTION */}
        <div className="w-full bg-[#030303] py-32 px-6 border-t border-white/[0.04]">
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
            <h2 className="text-3xl md:text-5xl font-medium text-white mb-6 tracking-[-0.04em] leading-tight">
              A clareza financeira que você merece.
            </h2>
            <p className="text-zinc-400 text-lg mb-10 max-w-xl">
              Deixe as planilhas para trás. Obtenha insights instantâneos sobre sua rentabilidade e tome decisões melhores.
            </p>
            <motion.button
              onClick={() => { setMode("register"); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 bg-white text-black px-8 py-3.5 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all"
            >
              Criar conta gratuitamente
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7-7m7-7H3" />
              </svg>
            </motion.button>
          </div>
        </div>
        
        {/* FOOTER */}
        <footer className="w-full py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between text-zinc-600 text-xs border-t border-white/[0.04]">
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
