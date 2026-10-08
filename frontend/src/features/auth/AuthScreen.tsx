import { FormEvent } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
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
  // Animação da seção esquerda
  const introVariants: Variants = {
    hidden: { opacity: 0, x: -50 },
    visible: { 
      opacity: 1, 
      x: 0, 
      transition: { duration: 0.8, ease: "easeOut", staggerChildren: 0.2 } 
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0b] text-gray-100 font-sans selection:bg-green-500/30 selection:text-green-200">
      
      {/* FULL SCREEN FLUID BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <AnimatedBackground />
        {/* Horizontal fade: fluid on left, glass/dark on right so fluid slightly bleeds through */}
        <div className="absolute inset-0 bg-gradient-to-b lg:bg-gradient-to-r from-transparent via-transparent lg:via-[#0a0a0b]/20 to-[#0a0a0b]/80 pointer-events-none" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col w-full">
        
        {/* HERO / AUTH SECTION */}
        <div className="flex flex-col lg:flex-row min-h-screen w-full relative">
          
          {/* LEFT SIDE - BRANDING */}
          <motion.div 
            className="relative flex-1 lg:flex-[1.2] flex flex-col justify-center px-8 py-16 lg:p-20"
            initial="hidden"
            animate="visible"
            variants={introVariants}
          >
            <div className="relative z-10 max-w-2xl mx-auto lg:mx-0">
              <motion.div variants={itemVariants} className="inline-flex items-center gap-3 text-green-400 font-extrabold text-sm tracking-[0.3em] uppercase mb-12 lg:mb-[20vh]">
                <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.9)] animate-pulse"></span>
                GanhoCerto
              </motion.div>
              <motion.h1 
                variants={itemVariants} 
                className="text-4xl sm:text-5xl lg:text-[4rem] font-extrabold leading-[1.1] tracking-tight text-white mb-8 drop-shadow-lg"
              >
                Faturar é o começo. <br className="hidden sm:block" /> 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">Lucrar é o destino.</span>
              </motion.h1>
              <motion.p 
                variants={itemVariants} 
                className="text-lg sm:text-xl text-gray-400 font-medium leading-relaxed max-w-xl drop-shadow-md"
              >
                Inteligência financeira para quem vive ao volante. Assuma o controle absoluto da sua margem de ganho.
              </motion.p>
            </div>
          </motion.div>

          {/* RIGHT SIDE - FORM */}
          <motion.div 
            className="relative z-20 flex-1 lg:flex-[0.8] flex items-center justify-center p-6 sm:p-10 lg:p-16"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <div className="w-full max-w-[440px] bg-[#121214]/40 backdrop-blur-3xl border border-gray-700/30 rounded-[2rem] p-8 sm:p-10 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
              
              {/* Tabs */}
            <div className="flex bg-[#0a0a0b] p-1.5 rounded-2xl mb-10 border border-gray-800/50" role="group">
              <button
                type="button"
                className={`relative flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-colors duration-200 ${mode === "login" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                onClick={() => setMode("login")}
                aria-pressed={mode === "login"}
              >
                <span className="relative z-10">Login</span>
                {mode === "login" && (
                  <motion.div 
                    className="absolute inset-0 bg-gray-800 rounded-xl z-0 border border-gray-700/50 shadow-sm" 
                    layoutId="tab-indicator" 
                  />
                )}
              </button>
              <button
                type="button"
                className={`relative flex-1 py-3 px-4 text-sm font-semibold rounded-xl transition-colors duration-200 ${mode === "register" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                onClick={() => setMode("register")}
                aria-pressed={mode === "register"}
              >
                <span className="relative z-10">Cadastro</span>
                {mode === "register" && (
                  <motion.div 
                    className="absolute inset-0 bg-gray-800 rounded-xl z-0 border border-gray-700/50 shadow-sm" 
                    layoutId="tab-indicator" 
                  />
                )}
              </button>
            </div>

            <form className="flex flex-col gap-6" onSubmit={onSubmit}>
              <AnimatePresence mode="wait">
                <motion.h2 
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-2xl font-bold text-white tracking-tight mb-2"
                >
                  {mode === "login" ? "Acesse sua conta" : "Crie sua conta"}
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
                    <label className="text-sm font-medium text-gray-300" htmlFor="auth-name">Nome completo</label>
                    <input
                      id="auth-name"
                      className="w-full px-4 py-3.5 bg-black/20 border border-white/5 rounded-xl text-white placeholder-gray-500/80 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500/50 hover:bg-black/40 hover:border-white/10 backdrop-blur-md"
                      placeholder="João Silva"
                      autoComplete="name"
                      name="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300 drop-shadow-sm" htmlFor="auth-email">E-mail</label>
                <input
                  id="auth-email"
                  className="w-full px-4 py-3.5 bg-black/20 border border-white/5 rounded-xl text-white placeholder-gray-500/80 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500/50 hover:bg-black/40 hover:border-white/10 backdrop-blur-md"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-300 drop-shadow-sm" htmlFor="auth-password">Senha</label>
                  {mode === "login" && (
                    <button
                      type="button"
                      className="text-xs font-medium text-green-400 hover:text-green-300 transition-colors drop-shadow-sm"
                      onClick={onForgotPassword}
                    >
                      Esqueceu?
                    </button>
                  )}
                </div>
                <input
                  id="auth-password"
                  className="w-full px-4 py-3.5 bg-black/20 border border-white/5 rounded-xl text-white placeholder-gray-500/80 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500/50 hover:bg-black/40 hover:border-white/10 backdrop-blur-md"
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "login" ? 1 : 6}
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <AnimatePresence>
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <FeedbackMessage kind="error">{message}</FeedbackMessage>
                  </motion.div>
                )}
                {successMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <FeedbackMessage kind="success">{successMessage}</FeedbackMessage>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full mt-4 py-4 rounded-xl bg-gradient-to-b from-green-400 to-green-600 text-green-950 font-bold text-base shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-green-400/50"
                disabled={isLoading}
                type="submit"
              >
                {isLoading ? "Processando..." : mode === "login" ? "Entrar na plataforma" : "Criar minha conta"}
              </motion.button>
            </form>
          </div>
        </motion.div>

        {/* FADE TRANSITION AND SCROLL INDICATOR */}
        <div className="absolute bottom-0 left-0 w-full h-32 md:h-56 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent z-30 pointer-events-none flex flex-col justify-end items-center pb-6 md:pb-10">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="hidden md:flex flex-col items-center gap-3"
          >
            <span className="text-gray-500/80 text-[10px] font-bold tracking-[0.3em] uppercase">Deslize</span>
            <motion.div 
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-6 h-10 border-2 border-gray-700/50 rounded-full flex justify-center p-1.5 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-[#050505]/30 backdrop-blur-sm"
            >
              <div className="w-1 h-2 bg-green-500/80 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* NEW SECTION BELOW */}
      <div className="w-full bg-[#050505] pt-16 pb-24 md:pt-20 md:pb-32 px-6 md:px-8 relative z-30">
        <div className="max-w-7xl w-full mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-16 md:mb-24"
          >
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
              Por que escolher o <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]">GanhoCerto</span>?
            </h2>
            <p className="text-gray-400 text-base md:text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
              A única plataforma que transforma as incertezas de motoristas e entregadores em dados precisos para o crescimento real.
            </p>
          </motion.div>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.2 }
              }
            }}
          >
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 40 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
              }}
              whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              className="bg-[#0a0a0b] p-8 md:p-10 rounded-[2rem] border border-gray-800/60 hover:border-green-500/40 hover:shadow-[0_0_40px_rgba(34,197,94,0.12)] transition-all duration-500 relative overflow-hidden group flex flex-col h-full"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-500/10 blur-[60px] rounded-full group-hover:bg-green-500/20 group-hover:blur-[80px] transition-all duration-700"></div>
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-8 border border-green-500/20 group-hover:scale-110 group-hover:bg-green-500/20 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all duration-300">
                <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">Gestão de Ganhos</h3>
              <p className="text-gray-400 leading-relaxed font-medium text-sm md:text-base flex-grow">Acompanhe suas corridas e entenda seu faturamento real, descontando automaticamente os gastos com combustível e manutenção.</p>
            </motion.div>
            
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 40 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
              }}
              whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              className="bg-[#0a0a0b] p-8 md:p-10 rounded-[2rem] border border-gray-800/60 hover:border-green-500/40 hover:shadow-[0_0_40px_rgba(34,197,94,0.12)] transition-all duration-500 relative overflow-hidden group flex flex-col h-full"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-500/10 blur-[60px] rounded-full group-hover:bg-green-500/20 group-hover:blur-[80px] transition-all duration-700"></div>
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-8 border border-green-500/20 group-hover:scale-110 group-hover:bg-green-500/20 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all duration-300">
                <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">Análise de Desempenho</h3>
              <p className="text-gray-400 leading-relaxed font-medium text-sm md:text-base flex-grow">Métricas avançadas sobre quais horários, regiões e aplicativos trazem o maior retorno para o seu perfil e veículo.</p>
            </motion.div>
            
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 40 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
              }}
              whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
              className="bg-[#0a0a0b] p-8 md:p-10 rounded-[2rem] border border-gray-800/60 hover:border-green-500/40 hover:shadow-[0_0_40px_rgba(34,197,94,0.12)] transition-all duration-500 relative overflow-hidden group flex flex-col h-full md:col-span-2 lg:col-span-1"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-500/10 blur-[60px] rounded-full group-hover:bg-green-500/20 group-hover:blur-[80px] transition-all duration-700"></div>
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-8 border border-green-500/20 group-hover:scale-110 group-hover:bg-green-500/20 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)] transition-all duration-300">
                <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">Segurança Financeira</h3>
              <p className="text-gray-400 leading-relaxed font-medium text-sm md:text-base flex-grow">Seus dados protegidos e sua independência financeira construída de forma inteligente, consistente e segura.</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
      </div>
    </div>
  );
}

