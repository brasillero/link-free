import { describe, expect, it } from "vitest";
import {
  bodyFileSchema,
  footerFileSchema,
  headerFileSchema,
} from "../../src/schema/files.js";

const profile = { component: "profile", image: "./a.png", name: "Jane" };
const socials = {
  component: "socials",
  links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }],
};
const link = { component: "link", title: "Blog", url: "https://b.dev" };
const text = { component: "text", text: "hi" };

describe("per-section file schemas", () => {
  it("header accepts profile and socials, rejects link and text", () => {
    expect(headerFileSchema.parse({ blocks: [profile, socials] }).blocks).toHaveLength(2);
    expect(() => headerFileSchema.parse({ blocks: [link] })).toThrow();
    expect(() => headerFileSchema.parse({ blocks: [text] })).toThrow();
  });

  it("body accepts only link blocks", () => {
    expect(bodyFileSchema.parse({ blocks: [link] }).blocks).toHaveLength(1);
    expect(() => bodyFileSchema.parse({ blocks: [profile] })).toThrow();
  });

  it("footer accepts only text blocks", () => {
    expect(footerFileSchema.parse({ blocks: [text] }).blocks).toHaveLength(1);
    expect(() => footerFileSchema.parse({ blocks: [link] })).toThrow();
  });

  it("matches the SECTION_COMPONENTS rule from loadSections", () => {
    expect(headerFileSchema.safeParse({ blocks: [profile] }).success).toBe(true);
    expect(headerFileSchema.safeParse({ blocks: [link] }).success).toBe(false);
    expect(bodyFileSchema.safeParse({ blocks: [text] }).success).toBe(false);
    expect(footerFileSchema.safeParse({ blocks: [socials] }).success).toBe(false);
  });
});
