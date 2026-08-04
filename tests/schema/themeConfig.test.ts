import { describe, expect, it } from "vitest";
import { themeConfigSchema } from "../../src/schema/files.js";

describe("themeConfigSchema", () => {
  it("applies defaults to an empty object", () => {
    expect(themeConfigSchema.parse({})).toEqual({ theme: "light" });
  });

  it("accepts a full config and strips unknown keys", () => {
    const parsed = themeConfigSchema.parse({
      theme: "dark",
      tokens: {
        accent: "#ff6b6b",
        backgroundImage: "https://example.com/bg.jpg",
        font: "serif",
        radius: "lg",
        avatarRadius: "full",
        density: "compact",
        futureToken: "x",
      },
    });
    expect(parsed.theme).toBe("dark");
    expect(parsed.tokens?.accent).toBe("#ff6b6b");
    expect("futureToken" in (parsed.tokens ?? {})).toBe(false);
  });

  it("rejects a bad enum token", () => {
    expect(() => themeConfigSchema.parse({ tokens: { radius: "huge" } })).toThrow();
  });

  it("accepts a local backgroundImage path", () => {
    const parsed = themeConfigSchema.parse({ tokens: { backgroundImage: "./bg.jpg" } });
    expect(parsed.tokens?.backgroundImage).toBe("./bg.jpg");
  });

  it("rejects an empty color token", () => {
    expect(() => themeConfigSchema.parse({ tokens: { accent: "" } })).toThrow();
  });

  it("rejects a color token containing '<'", () => {
    expect(() => themeConfigSchema.parse({ tokens: { accent: "red}</style>" } })).toThrow();
  });

  it("rejects a backgroundImage containing '<'", () => {
    expect(() =>
      themeConfigSchema.parse({ tokens: { backgroundImage: "https://example.com/</style>" } }),
    ).toThrow();
  });
});
