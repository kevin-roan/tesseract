import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DURATION_MS, EASE, LOOP_MS, PRESS_SCALE, STAGGER_ROW_CAP, stagger } from "../src/renderer/theme/motion";

const THEME_DIR = join(__dirname, "..", "src", "renderer", "theme");
const tokens = readFileSync(join(THEME_DIR, "tokens.css"), "utf8");
const base = readFileSync(join(THEME_DIR, "base.css"), "utf8");

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function rootToken(name: string): string | undefined {
  return tokens.match(new RegExp(`--to-${name}:\\s*([^;]+);`))?.[1]?.trim();
}

describe("motion tokens", () => {
  it("mirrors durations in CSS", () => {
    for (const [name, ms] of Object.entries(DURATION_MS)) {
      expect(rootToken(`duration-${kebab(name)}`)).toBe(`${ms}ms`);
    }
  });

  it("mirrors easings in CSS", () => {
    for (const [name, curve] of Object.entries(EASE)) {
      const value = rootToken(`ease-${kebab(name)}`);
      if (name === "linear") expect(value).toBe("linear");
      else expect(value).toBe(`cubic-bezier(${curve.join(", ")})`);
    }
  });

  it("mirrors press scales and loops", () => {
    expect(rootToken("press-scale")).toBe(String(PRESS_SCALE.control));
    expect(rootToken("press-scale-card")).toBe(String(PRESS_SCALE.card));
    expect(rootToken("pulse-duration")).toBe(`${LOOP_MS.pulse}ms`);
    expect(rootToken("shimmer-duration")).toBe(`${LOOP_MS.shimmer}ms`);
    expect(rootToken("spinner-duration")).toBe(`${LOOP_MS.spinner}ms`);
  });

  it("collapses motion when reduced", () => {
    const reduced = tokens.slice(tokens.indexOf("prefers-reduced-motion"));
    for (const name of ["fast", "normal", "slow"]) expect(reduced).toMatch(new RegExp(`--to-duration-${name}: 0ms`));
    expect(reduced).toMatch(/--to-press-scale: 1;/);
    expect(base).not.toMatch(/\[data-motion-essential\]/);
    expect(base.slice(base.indexOf("prefers-reduced-motion"))).toMatch(/animation-iteration-count: 1 !important/);
  });

  it("caps list staggers", () => {
    const capped = stagger(STAGGER_ROW_CAP + 50, 10);
    expect(capped.delay).toBeCloseTo((STAGGER_ROW_CAP * 10) / 1000);
  });
});
