import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const tokens = postcss.parse(readFileSync(new URL("./tokens.css", import.meta.url), "utf8"));
const styles = postcss.parse(readFileSync(new URL("../App.css", import.meta.url), "utf8"));
const values = new Map<string, string>();
tokens.walkDecls((declaration) => { values.set(declaration.prop, declaration.value); });

function color(name: string): string {
  const value = values.get(`--color-${name}`)!;
  return value.startsWith("var(") ? color(value.slice(12, -1)) : value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(color(foreground));
  const b = luminance(color(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("design tokens", () => {
  it.each([
    ["text", "surface"], ["text-muted", "surface-subtle"],
    ["on-brand", "brand"], ["on-brand", "brand-hover"],
    ["success", "success-surface"], ["info", "info-surface"],
    ["warning", "warning-surface"], ["danger", "danger-surface"],
    ["realized", "realized-surface"], ["estimated", "estimated-surface"],
    ["projected", "projected-surface"],
  ])("keeps %s readable on %s", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps controls and keyboard focus visible on white surfaces", () => {
    expect(contrast("control-border", "surface")).toBeGreaterThanOrEqual(3);
    expect(contrast("focus", "surface")).toBeGreaterThanOrEqual(3);
  });

  it("resolves all CSS token references and centralizes color literals", () => {
    const declared = new Set(values.keys());
    styles.walkDecls(/^--/, (declaration) => { declared.add(declaration.prop); });
    for (const sheet of [tokens, styles]) {
      sheet.walkDecls((declaration) => {
        for (const match of declaration.value.matchAll(/var\((--[\w-]+)/g)) {
          expect(declared.has(match[1]), match[1]).toBe(true);
        }
      });
    }
    expect(styles.toString()).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
  });

  it("does not scale type with viewport width", () => {
    styles.walkDecls("font-size", (declaration) => {
      expect(declaration.value).not.toMatch(/\d(?:vw|vh)/);
    });
  });
});

// ── Dark luxury scope ──
// Translucent tokens are blended over the dark canvas, which is what a viewer actually sees.

type Rgb = [number, number, number];

function token(name: string): string {
  const value = values.get(name)!;
  return value.startsWith("var(") ? token(value.slice(4, -1)) : value;
}

function blend(name: string, backdrop: Rgb): Rgb {
  const value = token(name);
  if (value.startsWith("#")) {
    return [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as Rgb;
  }
  const [, r, g, b, alpha] = value.match(/rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/)!.map(Number);
  return [r, g, b].map((channel, index) => channel * (alpha / 100) + backdrop[index] * (1 - alpha / 100)) as Rgb;
}

function ratio(foreground: Rgb, background: Rgb): number {
  const luminanceOf = (rgb: Rgb) => luminance(`#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`);
  const [a, b] = [luminanceOf(foreground), luminanceOf(background)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const canvas = blend("--color-lux-canvas", [0, 0, 0]);
const darkSurfaces: Record<string, Rgb> = {
  canvas,
  panel: blend("--color-lux-panel", canvas),
  surface: blend("--color-glass-bg-subtle", canvas),
  "surface-subtle": blend("--color-glass-bg-tabs", canvas),
};

describe("dark luxury tokens", () => {
  const luxScope = new Map<string, string>();
  styles.walkRules(".lux", (rule) => rule.walkDecls(/^--/, (declaration) => { luxScope.set(declaration.prop, declaration.value); }));

  it("maps the semantic tokens of the .lux scope to the dark values tested here", () => {
    expect(luxScope.get("--color-text")).toBe("var(--color-glass-text)");
    expect(luxScope.get("--color-text-muted")).toBe("var(--color-lux-text-muted)");
    expect(luxScope.get("--color-text-soft")).toBe("var(--color-lux-text-soft)");
    expect(luxScope.get("--color-control-border")).toBe("var(--color-lux-control-border)");
    expect(luxScope.get("--color-focus")).toBe("var(--color-accent-emerald-light)");
  });

  it.each(["--color-glass-text", "--color-lux-text-muted", "--color-lux-text-soft"])(
    "keeps %s readable on every dark surface",
    (foreground) => {
      for (const surface of Object.values(darkSurfaces)) {
        expect(ratio(blend(foreground, surface), surface)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each(["success", "info", "warning", "danger"])("keeps %s messages readable on their dark surface", (kind) => {
    const surface = blend(`--color-lux-${kind}-surface`, canvas);
    expect(ratio(blend(`--color-lux-${kind}`, surface), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dark buttons and links readable", () => {
    const onBrand = blend("--color-lux-void", canvas);
    expect(ratio(onBrand, blend("--color-accent-emerald", canvas))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(onBrand, blend("--color-accent-emerald-light", canvas))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(blend("--color-accent-emerald", darkSurfaces.surface), darkSurfaces.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dark form controls and keyboard focus visible", () => {
    for (const surface of [canvas, darkSurfaces.panel]) {
      expect(ratio(blend("--color-lux-control-border", surface), surface)).toBeGreaterThanOrEqual(3);
      expect(ratio(blend("--color-accent-emerald-light", surface), surface)).toBeGreaterThanOrEqual(3);
    }
  });
});
