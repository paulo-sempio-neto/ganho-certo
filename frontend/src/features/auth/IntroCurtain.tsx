import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Odometer } from "../../components/Odometer";
import { BrandMark } from "./AuthShell";
import { markIntroSeen } from "./intro";

const HOLD_MS = 1100;
const lift = { duration: 0.85, ease: [0.76, 0, 0.24, 1] } as const;

/**
 * Opening shot of the landing: the odometer clocks the day's kilometres, then
 * the curtain lifts off the page. It calls onReveal as the lift starts, so the
 * hero entrance plays while the curtain rises. Any click, key or wheel skips it.
 */
export function IntroCurtain({ onReveal }: { onReveal: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    markIntroSeen();
    const reveal = () => {
      setIsVisible(false);
      onReveal();
    };
    const timer = window.setTimeout(reveal, HOLD_MS);
    const skip = () => {
      window.clearTimeout(timer);
      reveal();
    };
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("wheel", skip, { once: true, passive: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onReveal]);

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="intro"
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-(--color-lux-void)"
          initial={{ y: "0%" }}
          exit={{ y: "-100%", transition: lift }}
        >
          <motion.div
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -24, transition: { duration: 0.4 } }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <BrandMark />
            <strong className="text-6xl font-medium tracking-[-0.04em] text-white sm:text-7xl">
              <Odometer value="195" />
              <span className="ml-2 text-2xl text-zinc-500 sm:text-3xl">km</span>
            </strong>
            <span className="text-sm text-zinc-500">Calculando o lucro real do seu dia...</span>
          </motion.div>
          {/* The lip of the curtain: a hairline of brand light along its bottom edge. */}
          <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
