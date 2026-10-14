/**
 * Button label that rolls on hover or keyboard focus of its `group` parent:
 * the text slides up out of a clip while an identical copy slides in from
 * below. Transform-only; the copy is hidden from screen readers.
 */
export function RollText({ children }: { children: string }) {
  const roll =
    "block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-full group-focus-visible:-translate-y-full";

  return (
    <span className="relative inline-block overflow-hidden align-top leading-[1.35]">
      <span className={roll}>{children}</span>
      <span aria-hidden="true" className={`absolute inset-x-0 top-full ${roll}`}>
        {children}
      </span>
    </span>
  );
}
