import { motion } from "framer-motion";

import { toOdometerCells } from "../utils/odometer";

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const roll = { type: "spring", stiffness: 140, damping: 20 } as const;

/**
 * A formatted value whose digits roll like a car odometer. Each column is a
 * 0-9 strip moved by translateY, clipped vertically. Screen readers get the
 * plain value once instead of the strips.
 */
export function Odometer({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`odometer relative inline-flex ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex leading-none tabular-nums">
        {toOdometerCells(value).map((cell) =>
          cell.digit === null ? (
            <span key={cell.key} className="whitespace-pre">
              {cell.char}
            </span>
          ) : (
            <span
              key={cell.key}
              // overflow: clip keeps wide digits unclipped sideways; older browsers fall back to hidden.
              className="relative inline-block overflow-hidden supports-[overflow:clip]:overflow-x-visible supports-[overflow:clip]:overflow-y-clip"
            >
              <span className="invisible">0</span>
              <motion.span
                className="absolute inset-x-0 top-0 flex flex-col"
                initial={{ y: "0em" }}
                animate={{ y: `${-cell.digit}em` }}
                transition={roll}
              >
                {STRIP.map((digit) => (
                  <span key={digit} className="h-[1em]">
                    {digit}
                  </span>
                ))}
              </motion.span>
            </span>
          ),
        )}
      </span>
    </span>
  );
}
