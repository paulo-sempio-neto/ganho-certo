import { useEffect } from "react";
import Lenis from "lenis";

let lenis: Lenis | null = null;

/**
 * Inertial wheel scrolling for the landing. Only for fine pointers without a
 * reduced-motion preference: touch, keyboard and assistive scrolling stay
 * native. The frame loop runs only while the page is gliding, never idle.
 */
export function useSmoothScroll() {
  useEffect(() => {
    const prefersNative =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches;
    if (prefersNative) return;

    const instance = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis = instance;
    let frame = 0;
    const loop = (time: number) => {
      instance.raf(time);
      frame = instance.isScrolling ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };
    instance.on("scroll", wake);
    window.addEventListener("wheel", wake, { passive: true });

    return () => {
      window.removeEventListener("wheel", wake);
      cancelAnimationFrame(frame);
      instance.destroy();
      if (lenis === instance) lenis = null;
    };
  }, []);
}

/** Glides back to the top through Lenis when it is running, natively otherwise. */
export function scrollToTop() {
  if (lenis) {
    lenis.scrollTo(0);
    requestAnimationFrame((time) => lenis?.raf(time));
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
