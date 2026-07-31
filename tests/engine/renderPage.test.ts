import { describe, expect, it } from "vitest";
import type { Sections } from "../../src/engine/loadSections.js";
import { renderPage } from "../../src/engine/renderPage.js";

const full: Sections = {
  site: {
    title: "Jane — Links",
    description: "all my links",
    lang: "en",
    canonicalUrl: "https://links.jane.dev",
    ogImage: "https://links.jane.dev/og.png",
  },
  header: [
    { component: "profile", image: "https://example.com/a.png", name: "Jane", bio: "dev" },
    {
      component: "socials",
      links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }],
    },
  ],
  body: [{ component: "link", title: "Blog", url: "https://b.dev" }],
  footer: [{ component: "text", text: "© 2026 Jane" }],
};

describe("renderPage", () => {
  it("renders a full document with all sections and SEO meta", () => {
    const html = renderPage(full);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Jane — Links</title>");
    expect(html).toContain('<meta name="description" content="all my links">');
    expect(html).toContain('<link rel="canonical" href="https://links.jane.dev">');
    expect(html).toContain('<meta property="og:title" content="Jane — Links">');
    expect(html).toContain('<meta property="og:type" content="profile">');
    expect(html).toContain('<meta property="og:image" content="https://links.jane.dev/og.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
    expect(html).toContain('<meta name="robots" content="index, follow">');
    expect(html).toContain("<header>");
    expect(html).toContain("<main>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<footer>");
    expect(html).not.toContain("<script");
  });

  it("omits sections whose file was absent", () => {
    const html = renderPage({ site: {}, header: null, body: null, footer: null });
    expect(html).not.toContain("<header>");
    expect(html).not.toContain("<main>");
    expect(html).not.toContain("<footer>");
  });

  it("falls back to profile name then 'Links' for the title", () => {
    const withProfile = renderPage({ ...full, site: {}, footer: null, body: null });
    expect(withProfile).toContain("<title>Jane</title>");

    const bare = renderPage({ site: {}, header: null, body: null, footer: null });
    expect(bare).toContain("<title>Links</title>");
  });

  it("omits canonical and og:image when not configured", () => {
    const html = renderPage({ ...full, site: { title: "T" }, footer: null });
    expect(html).not.toContain("canonical");
    expect(html).not.toContain("og:image");
  });

  it("uses site.lang for the html element", () => {
    const html = renderPage({ ...full, site: { lang: "pt-BR" } });
    expect(html).toContain('<html lang="pt-BR">');
  });
});
