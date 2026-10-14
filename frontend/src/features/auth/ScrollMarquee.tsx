import { motion, useReducedMotion, useScroll, useSpring, useTransform, useVelocity, type MotionValue } from "framer-motion";

import { wrap } from "../../utils/wrap";

const TERMS = ["Lucro real", "Custo por km", "Meta da semana", "Lucro por hora", "Manutenção em dia", "Sobra no bolso"];

function Row({ scrollY, skew, direction, outlined }: { scrollY: MotionValue<number>; skew: MotionValue<number>; direction: 1 | -1; outlined: boolean }) {
  const shouldReduceMotion = useReducedMotion();
  // The track holds the terms twice; moving it through -50%..0 and wrapping hides the seam.
  const x = useTransform(scrollY, (y) => `${wrap(-50, 0, direction * y * 0.012)}%`);

  return (
    <motion.div className="flex w-max will-change-transform" style={shouldReduceMotion ? undefined : { x, skewX: skew }}>
      {[0, 1].map((copy) => (
        <div key={copy} className="flex shrink-0 items-center">
          {TERMS.map((term, index) => (
            <span key={term} className="flex items-center">
              <span
                className={`px-6 text-5xl font-medium tracking-[-0.04em] sm:text-7xl lg:text-8xl ${
                  outlined === (index % 2 === 0)
                    ? "text-transparent [-webkit-text-stroke:1px_var(--color-lux-control-border)]"
                    : "text-white"
                }`}
              >
                {term}
              </span>
              <span className="h-3 w-3 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_18px_var(--color-lux-glow)] sm:h-4 sm:w-4" />
            </span>
          ))}
        </div>
      ))}
    </motion.div>
  );
}

/**
 * Two bands of oversized terms that travel with the scroll position (not with
 * time, so they stop when the page stops) in opposite directions, and lean
 * with the scroll velocity. Decorative: the terms restate the sections around.
 */
export function ScrollMarquee() {
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(velocity, { damping: 50, stiffness: 400 });
  const skew = useTransform(smoothVelocity, [-2500, 0, 2500], [7, 0, -7], { clamp: true });

  return (
    <section aria-hidden="true" className="relative flex flex-col gap-4 overflow-hidden border-y border-white/[0.04] bg-(--color-lux-void) py-14 sm:py-20">
      <Row scrollY={scrollY} skew={skew} direction={-1} outlined={false} />
      <Row scrollY={scrollY} skew={skew} direction={1} outlined />
    </section>
  );
}
