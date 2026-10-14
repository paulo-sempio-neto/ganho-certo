import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { lineReveal } from "./motion";

/**
 * One line of a heading that rises from behind a clipping mask. The padding
 * keeps descenders inside the mask; the negative margin cancels it in layout.
 */
export function MaskLine({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`block overflow-hidden pb-[0.12em] -mb-[0.12em] ${className}`}>
      <motion.span className="block" variants={lineReveal}>
        {children}
      </motion.span>
    </span>
  );
}
