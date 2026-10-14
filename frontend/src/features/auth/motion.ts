import type { Variants } from "framer-motion";

/** Spring presets shared by the auth surface. Both settle without overshoot. */
export const spring = {
  /** Sliding indicators and tactile feedback. */
  snappy: { type: "spring", stiffness: 380, damping: 30 },
  /** Entrances and value changes. */
  gentle: { type: "spring", stiffness: 120, damping: 22 },
} as const;

const fade = { duration: 0.6, ease: "easeOut" } as const;

/** Staggers the `reveal` entrance of its motion children. */
export function stagger(step = 0.12, delay = 0.05): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: step, delayChildren: delay } },
  };
}

/** Soft blur-in entrance. Animates transform, opacity and filter only. */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { y: spring.gentle, opacity: fade, filter: fade },
  },
};

/** Cross-fade between sibling panels inside an AnimatePresence. */
export const panelSwap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2 },
} as const;
