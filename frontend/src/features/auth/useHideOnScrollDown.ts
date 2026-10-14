import { useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";

/** True while the page scrolls down past `offset`, false as soon as it scrolls back up. */
export function useHideOnScrollDown(offset = 120) {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? latest;
    if (latest !== previous) setHidden(latest > previous && latest > offset);
  });

  return [hidden, setHidden] as const;
}
