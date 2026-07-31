import { describe, expect, it } from "vitest";
import { renderLink } from "../../src/components/link.js";
import { renderProfile } from "../../src/components/profile.js";
import { renderSocials } from "../../src/components/socials.js";
import { renderText } from "../../src/components/text.js";

describe("renderProfile", () => {
  it("renders image, h1 name and optional bio", () => {
    const html = renderProfile({
      component: "profile",
      image: "https://example.com/a.png",
      name: "Jane",
      bio: "dev",
    });
    expect(html).toContain('<img src="https://example.com/a.png" alt="Jane"');
    expect(html).toContain("<h1>Jane</h1>");
    expect(html).toContain("<p>dev</p>");
  });

  it("omits bio when absent", () => {
    const html = renderProfile({
      component: "profile",
      image: "https://example.com/a.png",
      name: "Jane",
    });
    expect(html).not.toContain("<p>");
  });

  it("escapes user text", () => {
    const html = renderProfile({
      component: "profile",
      image: "https://example.com/a.png",
      name: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderSocials", () => {
  it("renders a nav with rel=me icon links", () => {
    const html = renderSocials({
      component: "socials",
      links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }],
    });
    expect(html).toContain('<nav aria-label="Social links">');
    expect(html).toContain('href="https://github.com/jane"');
    expect(html).toContain('rel="me"');
    expect(html).toContain('aria-label="GitHub"');
    expect(html).toContain("<svg");
  });
});

describe("renderLink", () => {
  it("renders an li with anchor and optional description", () => {
    const withDesc = renderLink({
      component: "link",
      title: "Blog",
      url: "https://b.dev",
      description: "my writing",
    });
    expect(withDesc).toBe(
      '<li><a href="https://b.dev">Blog</a><small>my writing</small></li>',
    );

    const noDesc = renderLink({ component: "link", title: "Blog", url: "https://b.dev" });
    expect(noDesc).toBe('<li><a href="https://b.dev">Blog</a></li>');
  });

  it("escapes title and url", () => {
    const html = renderLink({
      component: "link",
      title: 'a"b<c',
      url: "https://b.dev/?q=1&r=2",
    });
    expect(html).toContain("a&quot;b&lt;c");
    expect(html).toContain("q=1&amp;r=2");
  });
});

describe("renderText", () => {
  it("renders an escaped paragraph", () => {
    expect(renderText({ component: "text", text: "© 2026 <b>Jane</b>" })).toBe(
      "<p>© 2026 &lt;b&gt;Jane&lt;/b&gt;</p>",
    );
  });
});
