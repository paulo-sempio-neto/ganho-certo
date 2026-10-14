import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface PremiumCTAProps {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}

/**
 * Premium call-to-action button with a sweep-shine hover effect.
 *
 * Uses a standard `<button>` instead of a magnetic wrapper so the click
 * target stays stationary — no "chasing the button" anti-pattern.
 */
export function PremiumCTA({ children, disabled, type = "submit", onClick }: PremiumCTAProps) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="
        group relative w-full mt-4 py-3.5 px-8
        rounded-lg overflow-hidden
        font-semibold text-base
        text-white
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer
      "
      whileTap={{ scale: 0.98 }}
      transition={{ scale: { type: "spring", stiffness: 400, damping: 17 } }}
    >
      {/* Multi-layer gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-700 transition-all duration-500" />
      
      {/* Ambient glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-emerald-500 to-emerald-600" />
      
      {/* Outer glow shadow (subtle) */}
      <div className="absolute -inset-1 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500 bg-emerald-500 blur-lg -z-10" />
      
      {/* Sweep shine effect */}
      <motion.div
        className="absolute inset-0 w-[200%]"
        style={{
          background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.35) 55%, transparent 60%)",
        }}
        initial={{ x: "-100%" }}
        whileHover={{
          x: "50%",
          transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
        }}
      />
      
      {/* Button text */}
      <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm">
        {children}
        <svg 
          className="w-5 h-5" 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </span>
    </motion.button>
  );
}
