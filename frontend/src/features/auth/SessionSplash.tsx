import { motion, MotionConfig } from "framer-motion";

import { BrandMark } from "./AuthShell";

/** Shown while a stored session is restored, so signed-in drivers never see the landing flash by. */
export function SessionSplash() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="lux grid min-h-screen place-items-center" role="status">
        <motion.div
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <BrandMark />
          <span className="sr-only">Carregando sua conta...</span>
          {/* One-shot progress line: eases to 90% and waits there, never loops. */}
          <span aria-hidden="true" className="h-px w-28 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.span
              className="block h-full w-full origin-left bg-emerald-400"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 0.9 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </span>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
