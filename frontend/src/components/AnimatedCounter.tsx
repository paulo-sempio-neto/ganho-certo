import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type SpringOptions,
} from "framer-motion";

interface AnimatedCounterProps {
  target: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Formats every frame; defaults to a rounded pt-BR integer. */
  format?: (value: number) => string;
  spring?: SpringOptions;
}

const defaultFormat = (value: number) => Math.round(value).toLocaleString("pt-BR");

/**
 * Counts towards `target` once it scrolls into view, then springs to every new
 * target. The text is a motion value, so frames never re-render React.
 */
export function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  className = "",
  format = defaultFormat,
  spring = { stiffness: 50, damping: 30, mass: 1 },
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const shouldReduceMotion = useReducedMotion();
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, spring);
  const display = useTransform(shouldReduceMotion ? motionVal : springVal, (latest) => `${prefix}${format(latest)}${suffix}`);

  useEffect(() => {
    if (isInView) {
      motionVal.set(target);
    }
  }, [isInView, target, motionVal]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}
