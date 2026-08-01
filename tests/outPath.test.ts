import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOutDir } from "../src/outPath.js";

describe("resolveOutDir", () => {
  it("defaults to <dir>/dist when out is not passed", () => {
    expect(resolveOutDir("/site", undefined)).toBe(resolve("/site", "dist"));
  });

  it("resolves an explicit out against the cwd", () => {
    expect(resolveOutDir("/site", "public")).toBe(resolve("public"));
  });

  it("keeps bare-build behavior (dir defaults to '.')", () => {
    expect(resolveOutDir(".", undefined)).toBe(resolve("dist"));
  });
});
