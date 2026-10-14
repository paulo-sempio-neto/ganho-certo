import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { RollText } from "../../components/RollText";
import { SUPPORT_EMAIL } from "../../utils/support";
import { scrollToTop } from "./smoothScroll";

const linkClass = "link-draw text-zinc-500 hover:text-white transition-colors";

/**
 * Closing footer: links and the brand line, over a full-width wordmark that
 * rises out of the floor as the page reaches its end. The wordmark is SVG so
 * it scales with the container instead of a viewport-based font size.
 */
export function SiteFooter() {
  const ref = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const rise = useTransform(scrollYProgress, [0, 1], ["45%", "0%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6, 1], [0, 0.6, 1]);

  return (
    <footer ref={ref} className="relative w-full overflow-hidden border-t border-white/[0.04] bg-(--color-lux-void)">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 pt-16 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <p className="text-2xl font-medium tracking-[-0.03em] text-white sm:text-3xl">Lucro real, todo dia.</p>
          <p className="text-sm text-zinc-600">GanhoCerto © 2026. Todos os direitos reservados.</p>
        </div>
        <div className="flex flex-col gap-4 text-sm sm:items-end">
          <nav className="flex gap-6" aria-label="Institucional">
            <a className={linkClass} href="/privacidade">Privacidade</a>
            <a className={linkClass} href="/termos">Termos de Uso</a>
            {SUPPORT_EMAIL ? (
              <a className={linkClass} href={`mailto:${SUPPORT_EMAIL}`}>Suporte</a>
            ) : null}
          </nav>
          <button type="button" onClick={scrollToTop} className="group w-fit cursor-pointer text-zinc-400 hover:text-white transition-colors">
            <RollText>Voltar ao topo ↑</RollText>
          </button>
        </div>
      </div>

      <motion.svg
        aria-hidden="true"
        viewBox="0 0 1000 190"
        className="mt-8 block w-full text-white"
        style={shouldReduceMotion ? undefined : { y: rise, opacity }}
      >
        {/* Solid glyphs faded by a mask, so overlapping letters never double up into seams. */}
        <defs>
          <linearGradient id="footer-wordmark-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0.05" />
          </linearGradient>
          <mask id="footer-wordmark-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="190">
            <rect width="1000" height="190" fill="url(#footer-wordmark-fade)" />
          </mask>
        </defs>
        <text
          x="500"
          y="172"
          textAnchor="middle"
          textLength="980"
          lengthAdjust="spacing"
          fontSize="200"
          className="font-medium tracking-[-0.06em]"
          fill="currentColor"
          mask="url(#footer-wordmark-mask)"
        >
          GanhoCerto
        </text>
      </motion.svg>
    </footer>
  );
}
