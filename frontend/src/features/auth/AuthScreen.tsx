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

import { CustomCursor } from "../../components/CustomCursor";

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
      <CustomCursor />
      
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
              <h1 className="text-4xl sm:text-5xl lg:text-[4.5rem] font-extrabold leading-[1.05] tracking-tight mb-8 drop-shadow-lg" style={{ perspective: "1000px" }}>
                <motion.span 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.03, delayChildren: 0.2 } }
                  }}
                  className="block text-white mb-2 flex flex-wrap"
                >
                  {"Faturar é o começo.".split(" ").map((word, i) => (
                    <span key={i} className="inline-block mr-3 lg:mr-4 whitespace-nowrap">
                      {word.split("").map((char, j) => (
                        <motion.span
                          key={j}
                          variants={{
                            hidden: { opacity: 0, y: 50, rotateX: -90, filter: "blur(10px)" },
                            visible: { opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] } }
                          }}
                          className="inline-block"
                        >
                          {char}
                        </motion.span>
                      ))}
                    </span>
                  ))}
                </motion.span>
                
                <motion.span 
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.8 } }
                  }}
                  className="block"
                >
                  <span className="flex flex-wrap text-transparent bg-clip-text bg-[linear-gradient(to_right,#ffffff,theme(colors.green.400),theme(colors.green.300),#ffffff)] bg-[length:200%_auto] animate-text-gradient pb-2">
                    {"Lucrar é o destino.".split(" ").map((word, i) => (
                      <span key={i} className="inline-block mr-3 lg:mr-4 whitespace-nowrap">
                        {word.split("").map((char, j) => (
                          <motion.span
                            key={j}
                            variants={{
                              hidden: { opacity: 0, y: 40, scale: 0.8, filter: "blur(10px)" },
                              visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] } }
                            }}
                            className="inline-block"
                          >
                            {char}
                          </motion.span>
                        ))}
                      </span>
                    ))}
                  </span>
                </motion.span>
              </h1>
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
                whileHover="hover"
                whileTap={{ scale: 0.98 }}
                className="relative w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-green-400 to-green-600 text-green-950 font-extrabold text-base shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-green-300/50 overflow-hidden"
                disabled={isLoading}
                type="submit"
              >
                {/* Efeito de brilho animado no hover via Framer Motion */}
                <motion.div 
                  variants={{
                    hover: {
                      x: ["-100%", "200%"],
                      transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                    }
                  }}
                  className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 -translate-x-full" 
                />
                <motion.span 
                  variants={{ hover: { scale: 1.02 } }}
                  className="relative z-10 drop-shadow-sm flex items-center justify-center"
                >
                  {isLoading ? "Processando..." : mode === "login" ? "Entrar na plataforma" : "Criar minha conta"}
                </motion.span>
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
        
        {/* BENTO BOX SECTION */}
        <div className="max-w-7xl w-full mx-auto mt-32 md:mt-48">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-16 md:mb-24"
          >
            <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight">
              Tudo o que você precisa <br className="hidden md:block" /> em um <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]">único painel.</span>
            </h2>
            <p className="text-gray-400 text-base md:text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
              Esqueça as planilhas e os cálculos mentais. O GanhoCerto faz o trabalho pesado para que você foque apenas em dirigir e lucrar.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 auto-rows-[280px]">
            {/* Bento Card 1: Large Span */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              whileHover={{ y: -5 }}
              className="md:col-span-2 bg-[#0a0a0b] p-8 md:p-10 rounded-[2rem] border border-gray-800/60 hover:border-green-500/40 hover:shadow-[0_0_40px_rgba(34,197,94,0.12)] transition-all duration-500 relative overflow-hidden group flex flex-col justify-end"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Decorative Tech Graphic */}
              <div className="absolute top-8 right-8 w-48 h-48 opacity-20 group-hover:opacity-60 transition-opacity duration-700">
                <svg viewBox="0 0 100 100" className="w-full h-full text-green-500 animate-[spin_60s_linear_infinite]">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
                  <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <path d="M 50 10 L 50 90 M 10 50 L 90 50" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 border border-white/10 backdrop-blur-md">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Lançamento Rápido</h3>
                <p className="text-gray-400 font-medium max-w-md">Registre suas corridas, abastecimentos e manutenções em segundos, com uma interface desenhada para uso entre uma corrida e outra.</p>
              </div>
            </motion.div>

            {/* Bento Card 2: Small Span */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ y: -5 }}
              className="bg-[#0a0a0b] p-8 rounded-[2rem] border border-gray-800/60 hover:border-green-500/40 hover:shadow-[0_0_40px_rgba(34,197,94,0.12)] transition-all duration-500 relative overflow-hidden group flex flex-col justify-between"
            >
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Relatórios Precisos</h3>
                <p className="text-gray-400 text-sm font-medium">Saiba exatamente quanto custa o seu KM rodado e sua hora trabalhada.</p>
              </div>
            </motion.div>

            {/* Bento Card 3: Small Span */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ y: -5 }}
              className="bg-[#0a0a0b] p-8 rounded-[2rem] border border-gray-800/60 hover:border-green-500/40 hover:shadow-[0_0_40px_rgba(34,197,94,0.12)] transition-all duration-500 relative overflow-hidden group flex flex-col justify-between"
            >
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Metas Inteligentes</h3>
                <p className="text-gray-400 text-sm font-medium">Configure metas diárias reais, baseadas no lucro líquido e não no faturamento bruto.</p>
              </div>
            </motion.div>

            {/* Bento Card 4: Large Span */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ y: -5 }}
              className="md:col-span-2 bg-[#0a0a0b] p-8 md:p-10 rounded-[2rem] border border-gray-800/60 hover:border-green-500/40 hover:shadow-[0_0_40px_rgba(34,197,94,0.12)] transition-all duration-500 relative overflow-hidden group flex flex-col justify-end md:flex-row md:justify-between md:items-end"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 blur-[80px] rounded-full group-hover:bg-green-500/10 transition-colors duration-500"></div>
              
              <div className="relative z-10 max-w-sm mb-6 md:mb-0">
                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 border border-white/10 backdrop-blur-md">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">Privacidade Total</h3>
                <p className="text-gray-400 font-medium">Seus dados financeiros rodam apenas no seu ambiente seguro. Nossa arquitetura garante isolamento absoluto das suas informações.</p>
              </div>

              {/* Decorative lock/shield graphic */}
              <div className="relative z-10 flex items-center justify-center w-32 h-32 bg-black/40 rounded-full border border-gray-800 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
                <div className="w-24 h-24 rounded-full border border-green-500/20 flex items-center justify-center animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                     <svg className="w-8 h-8 text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* MARQUEE TESTIMONIALS SECTION */}
        <div className="w-full mt-32 md:mt-48 overflow-hidden relative py-10">
          {/* Gradients to fade edges */}
          <div className="absolute top-0 left-0 w-32 md:w-64 h-full bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none"></div>
          <div className="absolute top-0 right-0 w-32 md:w-64 h-full bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none"></div>
          
          <div className="flex w-[200%] animate-marquee gap-6 md:gap-8">
            {/* Duplicate the array of cards so it loops infinitely */}
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-6 md:gap-8">
                {/* Card 1 */}
                <div className="w-80 md:w-[400px] shrink-0 bg-[#0a0a0b] border border-gray-800/50 p-8 rounded-3xl flex flex-col justify-between">
                  <div className="flex text-green-400 mb-6 gap-1">
                    {[1,2,3,4,5].map(s => <svg key={s} className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
                  </div>
                  <p className="text-gray-300 text-lg md:text-xl font-medium leading-relaxed mb-8">"Antes eu não sabia para onde meu dinheiro ia. Hoje sei exatamente quanto lucro a cada corrida."</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full p-[2px]">
                      <div className="w-full h-full bg-[#0a0a0b] rounded-full flex items-center justify-center text-white font-bold">M</div>
                    </div>
                    <div>
                      <h4 className="text-white font-bold">Marcos S.</h4>
                      <p className="text-gray-500 text-sm">Motorista de Aplicativo</p>
                    </div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="w-80 md:w-[400px] shrink-0 bg-[#0a0a0b] border border-gray-800/50 p-8 rounded-3xl flex flex-col justify-between">
                  <div className="flex text-green-400 mb-6 gap-1">
                    {[1,2,3,4,5].map(s => <svg key={s} className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
                  </div>
                  <p className="text-gray-300 text-lg md:text-xl font-medium leading-relaxed mb-8">"O GanhoCerto me mostrou que trocar os pneus na hora certa aumentou minha margem de lucro."</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full p-[2px]">
                      <div className="w-full h-full bg-[#0a0a0b] rounded-full flex items-center justify-center text-white font-bold">R</div>
                    </div>
                    <div>
                      <h4 className="text-white font-bold">Roberto A.</h4>
                      <p className="text-gray-500 text-sm">Entregador</p>
                    </div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="w-80 md:w-[400px] shrink-0 bg-[#0a0a0b] border border-gray-800/50 p-8 rounded-3xl flex flex-col justify-between">
                  <div className="flex text-green-400 mb-6 gap-1">
                    {[1,2,3,4,5].map(s => <svg key={s} className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
                  </div>
                  <p className="text-gray-300 text-lg md:text-xl font-medium leading-relaxed mb-8">"Bater meta ficou muito mais fácil quando você acompanha o líquido e não a ilusão do faturamento bruto."</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full p-[2px]">
                      <div className="w-full h-full bg-[#0a0a0b] rounded-full flex items-center justify-center text-white font-bold">J</div>
                    </div>
                    <div>
                      <h4 className="text-white font-bold">Juliana M.</h4>
                      <p className="text-gray-500 text-sm">Motorista VIP</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FINAL CTA SECTION */}
        <div className="max-w-5xl w-full mx-auto mt-32 md:mt-48 mb-20 relative">
          <div className="absolute inset-0 bg-green-500/10 blur-[120px] rounded-full pointer-events-none"></div>
          <div className="relative bg-[#0a0a0b]/80 backdrop-blur-2xl border border-gray-800/80 p-10 md:p-20 rounded-[3rem] text-center overflow-hidden">
            {/* Background geometric lines */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            <h2 className="relative z-10 text-4xl md:text-6xl font-extrabold text-white mb-6">
              Pronto para assumir o <br className="hidden md:block"/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">controle da sua rota?</span>
            </h2>
            <p className="relative z-10 text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
              Junte-se a milhares de motoristas e entregadores que pararam de contar moedas e começaram a lucrar como profissionais.
            </p>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setMode("register");
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="relative z-10 px-10 py-5 rounded-full bg-white text-black font-extrabold text-lg md:text-xl shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:bg-gray-100 transition-all duration-300"
            >
              Criar minha conta grátis
            </motion.button>
          </div>
        </div>
        
        {/* FOOTER */}
        <footer className="w-full border-t border-gray-900 mt-20 pt-10 pb-10 flex flex-col md:flex-row items-center justify-between text-gray-600 text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
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
    </div>
  );
}

