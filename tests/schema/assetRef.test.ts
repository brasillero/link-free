import { describe, expect, it } from "vitest";
import { assetRefSchema } from "../../src/schema/common.js";

describe("assetRefSchema", () => {
  it("accepts absolute URLs", () => {
    expect(assetRefSchema.parse("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("accepts relative local paths", () => {
    expect(assetRefSchema.parse("./avatar.png")).toBe("./avatar.png");
    expect(assetRefSchema.parse("images/bg.jpg")).toBe("images/bg.jpg");
  });

  it("rejects empty strings", () => {
    expect(() => assetRefSchema.parse("")).toThrow();
  });

  it("rejects '<' (style-breakout hardening)", () => {
    expect(() => assetRefSchema.parse("./a</style>.png")).toThrow();
  });
});
