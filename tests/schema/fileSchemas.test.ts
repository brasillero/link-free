import { describe, expect, it } from "vitest";
import { SECTION_COMPONENTS } from "../../src/engine/loadSections.js";
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

const FILE_SCHEMAS = {
  header: headerFileSchema,
  body: bodyFileSchema,
  footer: footerFileSchema,
} as const;

const BLOCK_FIXTURES = {
  profile,
  socials,
  link,
  text,
} as const;

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
    for (const [section, allowed] of Object.entries(SECTION_COMPONENTS)) {
      const schema = FILE_SCHEMAS[section as keyof typeof FILE_SCHEMAS];
      for (const [component, fixture] of Object.entries(BLOCK_FIXTURES)) {
        const shouldPass = allowed.includes(component);
        expect(
          schema.safeParse({ blocks: [fixture] }).success,
          `${section} ${shouldPass ? "accepts" : "rejects"} ${component}`,
        ).toBe(shouldPass);
      }
    }
  });
});
