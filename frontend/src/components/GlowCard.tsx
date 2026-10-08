import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card that tracks cursor position and projects a radial glow underneath,
 * simulating "lighting up a physical dashboard panel."
 */
export function GlowCard({ children, className = "" }: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 200, damping: 40 });
  const springY = useSpring(mouseY, { stiffness: 200, damping: 40 });

  const rotateX = useTransform(springY, [-0.5, 0.5], [3, -3]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-3, 3]);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const glowBackground = useTransform(
    [springX, springY],
    ([latestX, latestY]: number[]) => {
      const px = ((latestX as number) + 0.5) * 100;
      const py = ((latestY as number) + 0.5) * 100;
      return `radial-gradient(600px circle at ${px}% ${py}%, rgba(52, 211, 153, 0.12), transparent 50%)`;
    }
  );

  const borderBackground = useTransform(
    [springX, springY],
    ([latestX, latestY]: number[]) => {
      const px = ((latestX as number) + 0.5) * 100;
      const py = ((latestY as number) + 0.5) * 100;
      return `radial-gradient(400px circle at ${px}% ${py}%, rgba(52, 211, 153, 0.3), rgba(255,255,255,0.06) 50%, transparent 80%)`;
    }
  );

  return (
    <div className="relative group" style={{ perspective: "1000px" }}>
      {/* Border glow layer */}
      <motion.div
        className="absolute -inset-px rounded-[1.6rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: borderBackground }}
      />
      
      <motion.div
        ref={ref}
        className={`glass-bento relative ${className}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
      >
        {/* Inner radial glow */}
        <motion.div
          className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: glowBackground }}
        />
        
        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

