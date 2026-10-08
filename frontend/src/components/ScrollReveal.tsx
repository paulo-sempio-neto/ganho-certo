import { type ReactNode, useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds relative to stagger group */
  delay?: number;
  /** Vertical offset in pixels for parallax */
  parallaxOffset?: number;
}

/**
 * Scroll-triggered reveal with parallax depth.
 * Uses useScroll for 60fps GPU-composited animations.
 */
export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  parallaxOffset = 60,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const yRaw = useTransform(scrollYProgress, [0, 0.5, 1], [parallaxOffset, 0, -parallaxOffset / 3]);
  const y = useSpring(yRaw, { stiffness: 100, damping: 30, mass: 0.8 });

  const opacityRaw = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.8]);
  const opacity = useSpring(opacityRaw, { stiffness: 100, damping: 30 });

  const scaleRaw = useTransform(scrollYProgress, [0, 0.3], [0.95, 1]);
  const scale = useSpring(scaleRaw, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y, opacity, scale }}
      initial={{ opacity: 0, y: parallaxOffset }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { 
    opacity: 0, 
    y: 40, 
    filter: "blur(8px)",
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)",
    transition: { 
      duration: 0.8, 
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

