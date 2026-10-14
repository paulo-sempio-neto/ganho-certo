import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const GRAIN_TILE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/**
 * Ambient lighting behind the dark auth surface. The beams are plain radial
 * gradients (already soft, so no blur filter) that fade in once and then
 * drift up and dim slower than the page while scrolling, over a fixed grain
 * and dot grid. Nothing here loops; reduced motion keeps the beams still.
 */
export function AmbientBackground() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 1200], [0, -160]);
  const dim = useTransform(scrollY, [0, 1200], [1, 0.35]);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
    >
      {/* Diffuse light beams, with a slow scroll parallax */}
      <motion.div className="absolute inset-0" style={shouldReduceMotion ? undefined : { y: drift, opacity: dim }}>
        <div className="absolute -top-[20%] -left-[15%] h-[70%] w-[65%] bg-[radial-gradient(closest-side,var(--color-lux-beam),transparent)]" />
        <div className="absolute -bottom-[15%] -right-[20%] h-[60%] w-[60%] bg-[radial-gradient(closest-side,var(--color-lux-beam-neutral),transparent)]" />
        <div className="absolute top-0 left-1/2 h-[350px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,var(--color-glass-focus-glow)_0%,transparent_70%)]" />
      </motion.div>

      {/* Ultra-fine dot grid */}
      <div className="absolute inset-0 opacity-[0.035] [background-image:radial-gradient(circle,var(--color-glass-white)_0.5px,transparent_0.5px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_0%,transparent_75%)]" />

      {/* Film grain: one 200px noise tile, repeated. No blend mode, so scrolling stays cheap. */}
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: GRAIN_TILE }} />
    </motion.div>
  );
}
