import { type PointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, type Variants } from "framer-motion";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  variants?: Variants;
}

const follow = { stiffness: 300, damping: 30 };

/**
 * Card with a soft spotlight that follows a mouse pointer, like light passing
 * over a physical panel. The light moves by transform and fades by opacity
 * only, and touch input never triggers it.
 */
export function GlowCard({ children, className = "", variants }: GlowCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const glow = useMotionValue(0);
  const springX = useSpring(x, follow);
  const springY = useSpring(y, follow);
  const opacity = useSpring(glow, follow);

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
    glow.set(1);
  }

  return (
    <motion.article
      variants={variants}
      className={`relative isolate overflow-hidden ${className}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => glow.set(0)}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -left-[180px] -top-[180px] -z-10 h-[360px] w-[360px] rounded-full bg-[radial-gradient(closest-side,var(--color-glass-focus-glow),transparent)]"
        style={{ x: springX, y: springY, opacity }}
      />
      {children}
    </motion.article>
  );
}
