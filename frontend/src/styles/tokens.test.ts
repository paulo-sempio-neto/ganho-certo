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
