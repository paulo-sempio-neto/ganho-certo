import { motion } from "framer-motion";

/**
 * Static ambient lighting behind the dark auth surface. The beams are plain
 * radial gradients (already soft, so no blur filter) and only fade in once:
 * nothing here loops.
 */
export function AmbientBackground() {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      {/* Diffuse light beams */}
      <div className="absolute -top-[20%] -left-[15%] h-[70%] w-[65%] bg-[radial-gradient(closest-side,var(--color-lux-beam),transparent)]" />
      <div className="absolute -bottom-[15%] -right-[20%] h-[60%] w-[60%] bg-[radial-gradient(closest-side,var(--color-lux-beam-neutral),transparent)]" />
      <div className="absolute top-0 left-1/2 h-[350px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,var(--color-glass-focus-glow)_0%,transparent_70%)]" />

      {/* Ultra-fine dot grid */}
      <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle,var(--color-glass-white)_0.5px,transparent_0.5px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_75%)]" />
    </motion.div>
  );
}
