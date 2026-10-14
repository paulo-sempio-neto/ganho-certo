import type { ReactNode } from "react";
import { motion, MotionConfig } from "framer-motion";

import { AmbientBackground } from "./AmbientBackground";
import { reveal } from "./motion";

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_var(--color-lux-glow)]">
        <span className="text-emerald-400 font-bold text-sm tracking-tighter">GC</span>
      </div>
      <span className="font-semibold text-lg text-white tracking-tight">GanhoCerto</span>
    </div>
  );
}

/** Dark single-card layout for the secondary auth steps (forgot and reset password). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="lux relative min-h-screen w-full overflow-x-hidden">
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen flex-col">
          <header className="w-full max-w-7xl mx-auto px-6 py-6 border-b border-white/[0.04]">
            <BrandMark />
          </header>
          <main className="flex flex-1 items-center justify-center px-6 py-12">
            <motion.div
              className="w-full max-w-[420px] rounded-2xl bg-zinc-950/90 border border-white/[0.08] p-6 sm:p-8 shadow-2xl lg:backdrop-blur-2xl"
              variants={reveal}
              initial="hidden"
              animate="visible"
            >
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
