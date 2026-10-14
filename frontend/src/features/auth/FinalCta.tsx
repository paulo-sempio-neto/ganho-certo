import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { RollText } from "../../components/RollText";
import { MaskLine } from "./MaskLine";
import { SectionIndex } from "./SectionIndex";
import { stagger } from "./motion";

/**
 * Closing call to action. The block grows into place until its bottom edge
 * reaches the bottom of the viewport, and the button sweeps a single sheen across on
 * hover (a translated overlay, never looping).
 */
export function FinalCta({ onStart }: { onStart: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.3, 1]);

  return (
    <section className="w-full bg-(--color-lux-void) py-24 px-6 border-t border-white/[0.04]">
      <motion.div
        ref={ref}
        className="max-w-3xl mx-auto text-center flex flex-col items-center gap-6"
        style={shouldReduceMotion ? undefined : { scale, opacity }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.5 }}
        variants={stagger(0.12, 0)}
      >
        <SectionIndex index="04" label="Comece agora" />
        <h2 className="text-3xl sm:text-5xl font-medium text-white tracking-[-0.03em] leading-tight">
          <MaskLine>Pronto para ter</MaskLine>
          <MaskLine>o controle total</MaskLine>
          <MaskLine>do seu volante?</MaskLine>
        </h2>
        <p className="text-zinc-400 text-base max-w-lg">
          Cadastre-se gratuitamente em segundos e veja exatamente quanto sobra no seu bolso hoje.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="group relative overflow-hidden py-3.5 px-8 rounded-xl bg-white hover:bg-zinc-200 active:scale-[0.98] text-black font-semibold text-sm transition-[background-color,transform] duration-200 shadow-[0_0_35px_var(--color-glass-border-hover)] flex items-center gap-2 cursor-pointer mt-2"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          />
          <span className="relative">
            <RollText>Começar agora gratuitamente</RollText>
          </span>
          <svg className="relative w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </motion.div>
    </section>
  );
}
