import { describe, expect, it } from "vitest";
import { sectionFileSchema, siteFileSchema } from "../../src/schema/files.js";

describe("siteFileSchema", () => {
  it("accepts a full site object", () => {
    const parsed = siteFileSchema.parse({
      title: "Jane",
      description: "links",
      lang: "pt-BR",
      canonicalUrl: "https://links.jane.dev",
      ogImage: "https://links.jane.dev/og.png",
    });
    expect(parsed.lang).toBe("pt-BR");
  });

  it("accepts an empty object (everything optional)", () => {
    expect(siteFileSchema.parse({})).toEqual({});
  });

  it("rejects an invalid canonicalUrl", () => {
    expect(() => siteFileSchema.parse({ canonicalUrl: "nope" })).toThrow();
  });
});

describe("sectionFileSchema", () => {
  it("accepts a blocks wrapper", () => {
    const parsed = sectionFileSchema.parse({ blocks: [{ component: "text", text: "hi" }] });
    expect(parsed.blocks).toHaveLength(1);
  });

  it("rejects a bare array", () => {
    expect(() => sectionFileSchema.parse([{ component: "text", text: "hi" }])).toThrow();
  });
});
