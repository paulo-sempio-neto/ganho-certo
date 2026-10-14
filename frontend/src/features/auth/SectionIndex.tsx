import { MaskLine } from "./MaskLine";

/** Editorial section marker ("01 — Label") that rises through its line mask with the heading. */
export function SectionIndex({ index, label, className = "" }: { index: string; label: string; className?: string }) {
  return (
    <MaskLine className={className}>
      <span className="inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-widest">
        <span className="tabular-nums text-zinc-500">{index}</span>
        <span aria-hidden="true" className="h-px w-8 bg-emerald-400/60" />
        <span className="text-emerald-400">{label}</span>
      </span>
    </MaskLine>
  );
}
