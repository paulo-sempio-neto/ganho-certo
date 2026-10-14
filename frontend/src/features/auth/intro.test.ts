import { describe, expect, it } from "vitest";

import { shouldPlayIntro } from "./intro";

describe("shouldPlayIntro", () => {
  it("plays on the first visit of a session", () => {
    expect(shouldPlayIntro({ seen: false, reducedMotion: false })).toBe(true);
  });

  it("does not replay in the same session or with reduced motion", () => {
    expect(shouldPlayIntro({ seen: true, reducedMotion: false })).toBe(false);
    expect(shouldPlayIntro({ seen: false, reducedMotion: true })).toBe(false);
  });
});
