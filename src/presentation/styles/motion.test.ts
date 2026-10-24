/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(path, "utf8").replace(/\r\n/g, "\n");
describe("T043 static-first motion policy", () => {
  it("adds only the approved duration and easing aliases", () => {
    const tokens = read("src/presentation/styles/tokens.css");
    for (const [name, value] of [
      ["fast", "120ms"],
      ["standard", "180ms"],
      ["model", "240ms"],
      ["easing", "cubic-bezier(0.2, 0, 0, 1)"],
    ]) {
      expect(tokens).toContain(`--motion-${name}: ${value};`);
    }
    expect(tokens.match(/--motion-[\w-]+:/g)).toHaveLength(4);
    const base = read("src/presentation/styles/base.css");
    expect(
      base.startsWith('@import "./tokens.css";\n@import "./motion.css";'),
    ).toBe(true);
    expect(base.match(/@import "\.\/motion.css"/g)).toHaveLength(1);
  });
  it("only opts color interpolation in under no-preference and never delays semantic exposure", () => {
    const css = read("src/presentation/styles/motion.css").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const preference = css.indexOf(
      "@media (prefers-reduced-motion: no-preference)",
    );
    expect(preference).toBeGreaterThan(0);
    expect(css.slice(0, preference)).not.toMatch(/transition|animation\s*:/);
    expect(css).toContain(
      "transition-property: background-color, border-color;",
    );
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition: none;");
    expect(css).not.toMatch(
      /opacity|visibility|display\s*:|transform|@keyframes|transition-delay|animation-delay/,
    );
    for (const file of [
      "public.tsx",
      "LoadingPresentation.tsx",
      "useDelayedLoading.ts",
    ]) {
      expect(read(`src/presentation/technical/${file}`)).not.toMatch(
        /animationend|transitionend|requestAnimationFrame|\.send\(|session\/|recovery\//,
      );
    }
  });
});
