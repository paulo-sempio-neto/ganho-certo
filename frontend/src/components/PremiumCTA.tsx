import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { MagneticButton } from "./MagneticButton";

interface PremiumCTAProps {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}

export function PremiumCTA({ children, disabled, type = "submit", onClick }: PremiumCTAProps) {
  return (
    <MagneticButton
      type={type}
      disabled={disabled}
      onClick={onClick}
      strength={0.25}
      className="
        group relative w-full mt-4 py-4 px-8
        rounded-2xl overflow-hidden
        font-semibold text-base
        text-emerald-950
        disabled:opacity-50 disabled:cursor-not-allowed
        cursor-pointer
      "
    >
      {/* Multi-layer gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500 transition-all duration-500" />
      
      {/* Ambient glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-emerald-300 via-green-300 to-emerald-400" />
      
      {/* Outer glow shadow */}
      <div className="absolute -inset-1 rounded-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-500 bg-gradient-to-r from-emerald-400 to-green-500 blur-xl -z-10" />
      
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
        <motion.svg 
          className="w-5 h-5" 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
          initial={{ x: 0 }}
          whileHover={{ x: 4 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </motion.svg>
      </span>
    </MagneticButton>
  );
}

