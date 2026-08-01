import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tailwind precompile pipeline", () => {
  it("generates a minified stylesheet with no tailwind directives left", () => {
    execSync("pnpm css", { stdio: "inherit" });
    const mod = readFileSync("src/theme/styles.css.ts", "utf8");
    expect(mod).toContain("export const stylesCss");
    const css = JSON.parse(mod.match(/export const stylesCss = (".*");/s)![1]) as string;
    expect(css.length).toBeGreaterThan(500);
    expect(css).not.toContain("@tailwind");
    expect(css).not.toContain("@apply");
    expect(css).toContain("--lf-surface");
  });
});
