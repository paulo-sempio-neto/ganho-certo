import { motion } from "framer-motion";

const GRAIN_TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

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

      {/* Film grain: one 200px noise tile, repeated. No blend mode, so scrolling stays cheap. */}
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: GRAIN_TILE }} />
    </motion.div>
  );
}
