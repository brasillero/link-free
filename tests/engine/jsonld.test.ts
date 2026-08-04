import { describe, expect, it } from "vitest";
import { buildJsonLd } from "../../src/engine/jsonld.js";
import type { Sections } from "../../src/engine/loadSections.js";

const base: Sections = {
  site: {},
  theme: { theme: "light" },
  header: null,
  body: null,
  footer: null,
};

const withProfile: Sections = {
  ...base,
  site: { canonicalUrl: "https://links.jane.dev" },
  header: [
    { component: "profile", image: "assets/avatar.png", name: "Jane", bio: "dev" },
    {
      component: "socials",
      links: [
        { icon: "github", url: "https://github.com/jane", label: "GitHub" },
        { icon: "x", url: "https://x.com/jane", label: "X" },
      ],
    },
  ],
};

/** Extract and parse the JSON payload from the script tag. */
function parse(tag: string): Record<string, unknown> {
  const match = tag.match(/^<script type="application\/ld\+json">(.*)<\/script>$/s);
  expect(match, "script tag shape").not.toBeNull();
  return JSON.parse(match![1]);
}

describe("buildJsonLd", () => {
  it("maps all fields with a full profile", () => {
    const tag = buildJsonLd(withProfile);
    expect(tag).not.toBeNull();
    const data = parse(tag!);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("ProfilePage");
    const entity = data.mainEntity as Record<string, unknown>;
    expect(entity["@type"]).toBe("Person");
    expect(entity.name).toBe("Jane");
    expect(entity.image).toBe("https://links.jane.dev/assets/avatar.png");
    expect(entity.description).toBe("dev");
    expect(entity.url).toBe("https://links.jane.dev");
    expect(entity.sameAs).toEqual(["https://github.com/jane", "https://x.com/jane"]);
  });

  it("returns null without a profile block", () => {
    expect(buildJsonLd(base)).toBeNull();
    expect(
      buildJsonLd({ ...base, header: [{ component: "text", text: "hi" }] }),
    ).toBeNull();
  });

  it("omits description when bio is absent", () => {
    const sections: Sections = {
      ...withProfile,
      header: [{ component: "profile", image: "assets/avatar.png", name: "Jane" }],
    };
    const entity = parse(buildJsonLd(sections)!).mainEntity as Record<string, unknown>;
    expect("description" in entity).toBe(false);
  });

  it("omits url and keeps relative image without canonicalUrl", () => {
    const sections: Sections = {
      ...withProfile,
      site: {},
    };
    const entity = parse(buildJsonLd(sections)!).mainEntity as Record<string, unknown>;
    expect("url" in entity).toBe(false);
    expect(entity.image).toBe("assets/avatar.png");
  });

  it("keeps remote image URLs untouched when canonicalUrl is set", () => {
    const sections: Sections = {
      ...withProfile,
      header: [{ component: "profile", image: "https://cdn.example.com/a.png", name: "Jane" }],
    };
    const entity = parse(buildJsonLd(sections)!).mainEntity as Record<string, unknown>;
    expect(entity.image).toBe("https://cdn.example.com/a.png");
  });

  it("omits sameAs without a socials block", () => {
    const sections: Sections = {
      ...withProfile,
      header: [{ component: "profile", image: "assets/avatar.png", name: "Jane" }],
    };
    const entity = parse(buildJsonLd(sections)!).mainEntity as Record<string, unknown>;
    expect("sameAs" in entity).toBe(false);
  });

  it("escapes '<' so a name cannot close the script tag", () => {
    const sections: Sections = {
      ...withProfile,
      header: [
        { component: "profile", image: "assets/avatar.png", name: "</script><b>x</b>" },
      ],
    };
    const tag = buildJsonLd(sections)!;
    expect(tag).not.toContain("</script><b>");
    expect(tag).toContain("\\u003c/script>");
    const entity = parse(tag).mainEntity as Record<string, unknown>;
    expect(entity.name).toBe("</script><b>x</b>"); // parses back to the real value
  });
});
