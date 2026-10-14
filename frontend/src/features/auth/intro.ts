const INTRO_SEEN_KEY = "ganhocerto.introSeen";

/** The opening plays once per browser session, never for reduced motion. */
export function shouldPlayIntro({ seen, reducedMotion }: { seen: boolean; reducedMotion: boolean }): boolean {
  return !seen && !reducedMotion;
}

/** Reads the session flag and motion preference; storage can throw in private modes. */
export function readIntroState(): { seen: boolean; reducedMotion: boolean } {
  let seen = false;
  try {
    seen = sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    seen = true; // Without storage, skip rather than replay on every visit.
  }
  return { seen, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Nothing to remember without storage.
  }
}
