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
  theme: { theme: "light" },
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
    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).toContain("<ul");
    expect(html).toContain("<footer");
    expect(html).not.toContain("<script");
  });

  it("omits sections whose file was absent", () => {
    const html = renderPage({ site: {}, theme: { theme: "light" }, header: null, body: null, footer: null });
    expect(html).not.toContain("<header");
    expect(html).not.toContain("<main");
    expect(html).not.toContain("<footer");
  });

  it("falls back to profile name then 'Links' for the title", () => {
    const withProfile = renderPage({ ...full, site: {}, footer: null, body: null });
    expect(withProfile).toContain("<title>Jane</title>");

    const bare = renderPage({ site: {}, theme: { theme: "light" }, header: null, body: null, footer: null });
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

  it("omits sections with an empty blocks array", () => {
    const html = renderPage({ site: {}, theme: { theme: "light" }, header: [], body: [], footer: [] });
    expect(html).not.toContain("<header");
    expect(html).not.toContain("<main");
    expect(html).not.toContain("<footer");
  });

  it("falls back when site.title is an empty string", () => {
    const html = renderPage({ ...full, site: { title: "" }, body: null, footer: null });
    expect(html).toContain("<title>Jane</title>");
  });

  it("escapes page-level title and description", () => {
    const html = renderPage({
      ...full,
      site: { title: '<script>alert(1)</script>', description: 'a"b' },
      header: null,
      body: null,
      footer: null,
    });
    expect(html).toContain("<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>");
    expect(html).toContain('<meta name="description" content="a&quot;b">');
  });

  it("falls back to profile bio for description and emits og:description", () => {
    const html = renderPage({ ...full, site: {}, body: null, footer: null });
    expect(html).toContain('<meta name="description" content="dev">');
    expect(html).toContain('<meta property="og:description" content="dev">');
  });

  it("emits precompiled css and resolved theme variables in two style tags", () => {
    const html = renderPage(full);
    expect(html).toContain("<style>");
    expect(html).toContain("--lf-bg: #fafafa;");
    expect(html.indexOf("</head>")).toBeGreaterThan(html.indexOf("--lf-bg"));
    expect(html.indexOf("<style>")).toBeLessThan(html.indexOf("--lf-bg:"));
  });

  it("resolves token overrides into the :root block", () => {
    const html = renderPage({
      ...full,
      theme: { theme: "dark", tokens: { accent: "#ff6b6b" } },
    });
    expect(html).toContain("--lf-accent: #ff6b6b;");
    expect(html).toContain("--lf-bg: #0a0a0a;");
  });

  it("emits bg-image variables only when configured", () => {
    const without = renderPage(full);
    expect(without).not.toContain("--lf-bg-image:");

    const withImage = renderPage({
      ...full,
      theme: { theme: "dark", tokens: { backgroundImage: "https://example.com/bg.jpg" } },
    });
    expect(withImage).toContain('--lf-bg-image: url("https://example.com/bg.jpg");');
    expect(withImage).toContain("--lf-overlay:");
  });

  it("applies layout classes to body and sections", () => {
    const html = renderPage(full);
    expect(html).toContain('<body class="lf-page flex min-h-screen flex-col items-center font-sans text-ink">');
    expect(html).toContain('<main class="mx-auto w-full max-w-md flex-1 px-6 py-10">');
    expect(html).toContain('<ul class="flex flex-col gap-[var(--lf-spacing)]">');
  });

  it("emits preset extra css for the minimal theme", () => {
    const html = renderPage({ ...full, theme: { theme: "minimal" } });
    expect(html).toContain(".lf-link{background:transparent;text-decoration:underline;box-shadow:none}");
  });
});
