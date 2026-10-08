import { useEffect, useRef, useState } from "react";
import { useInView, motion, useSpring, useMotionValue } from "framer-motion";

interface AnimatedCounterProps {
  target: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  className = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [displayValue, setDisplayValue] = useState(0);
  
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, {
    stiffness: 50,
    damping: 30,
    mass: 1,
  });

  useEffect(() => {
    if (isInView) {
      motionVal.set(target);
    }
  }, [isInView, target, motionVal]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return unsubscribe;
  }, [spring]);

  return (
    <motion.span
      ref={ref}
      className={className}
    >
      {prefix}{displayValue.toLocaleString("pt-BR")}{suffix}
    </motion.span>
  );
}

