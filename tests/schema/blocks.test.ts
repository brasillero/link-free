import { describe, expect, it } from "vitest";
import {
  ICON_NAMES,
  linkBlockSchema,
  profileBlockSchema,
  socialsBlockSchema,
  textBlockSchema,
} from "../../src/schema/blocks.js";

describe("profileBlockSchema", () => {
  it("accepts a valid block and strips unknown keys", () => {
    const parsed = profileBlockSchema.parse({
      component: "profile",
      image: "https://example.com/a.png",
      name: "Jane",
      bio: "hi",
      futureField: true,
    });
    expect(parsed).toEqual({
      component: "profile",
      image: "https://example.com/a.png",
      name: "Jane",
      bio: "hi",
    });
    expect("futureField" in parsed).toBe(false);
  });

  it("rejects an invalid image URL", () => {
    expect(() =>
      profileBlockSchema.parse({ component: "profile", image: "not-a-url", name: "Jane" }),
    ).toThrow();
  });

  it("rejects a missing name", () => {
    expect(() =>
      profileBlockSchema.parse({ component: "profile", image: "https://example.com/a.png" }),
    ).toThrow();
  });
});

describe("socialsBlockSchema", () => {
  it("accepts a valid block", () => {
    const parsed = socialsBlockSchema.parse({
      component: "socials",
      links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }],
    });
    expect(parsed.links).toHaveLength(1);
  });

  it("rejects an unknown icon", () => {
    expect(() =>
      socialsBlockSchema.parse({
        component: "socials",
        links: [{ icon: "myspace", url: "https://x.com", label: "X" }],
      }),
    ).toThrow();
  });

  it("rejects an empty links array", () => {
    expect(() => socialsBlockSchema.parse({ component: "socials", links: [] })).toThrow();
  });
});

describe("linkBlockSchema", () => {
  it("accepts valid input, description optional", () => {
    expect(
      linkBlockSchema.parse({ component: "link", title: "Blog", url: "https://b.dev" }),
    ).toEqual({ component: "link", title: "Blog", url: "https://b.dev" });
  });

  it("rejects an invalid url", () => {
    expect(() =>
      linkBlockSchema.parse({ component: "link", title: "Blog", url: "nope" }),
    ).toThrow();
  });
});

describe("textBlockSchema", () => {
  it("accepts valid input", () => {
    expect(textBlockSchema.parse({ component: "text", text: "© 2026" })).toEqual({
      component: "text",
      text: "© 2026",
    });
  });
});

describe("ICON_NAMES", () => {
  it("contains the 8 documented icons", () => {
    expect([...ICON_NAMES].sort()).toEqual(
      ["github", "instagram", "linkedin", "mastodon", "tiktok", "website", "x", "youtube"].sort(),
    );
  });
});
