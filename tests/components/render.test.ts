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
    expect(html).toContain('class="h-24 w-24 rounded-avatar object-cover"');
    expect(html).toContain('<h1 class="text-2xl font-semibold text-ink">Jane</h1>');
    expect(html).toContain('<p class="text-muted">dev</p>');
  });

  it("omits bio when absent", () => {
    const html = renderProfile({
      component: "profile",
      image: "https://example.com/a.png",
      name: "Jane",
    });
    expect(html).not.toContain("<p");
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
    expect(html).toContain('<nav aria-label="Social links" class="flex items-center gap-5">');
    expect(html).toContain('href="https://github.com/jane"');
    expect(html).toContain('rel="me"');
    expect(html).toContain('aria-label="GitHub"');
    expect(html).toContain("<svg");
    expect(html).toContain("focus-visible:text-accent");
  });

  it("escapes label and url", () => {
    const html = renderSocials({
      component: "socials",
      links: [{ icon: "website", url: "https://a.dev/?x=1&y=2", label: 'My "Site"' }],
    });
    expect(html).toContain('aria-label="My &quot;Site&quot;"');
    expect(html).toContain("x=1&amp;y=2");
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
      '<li><a href="https://b.dev" class="lf-link block rounded-card bg-surface px-5 py-4 text-center font-medium text-ink shadow-sm transition hover:scale-[1.02] hover:text-accent focus-visible:scale-[1.02] focus-visible:text-accent">Blog</a><small class="mt-1 block text-center text-sm text-muted">my writing</small></li>',
    );

    const noDesc = renderLink({ component: "link", title: "Blog", url: "https://b.dev" });
    expect(noDesc).toBe(
      '<li><a href="https://b.dev" class="lf-link block rounded-card bg-surface px-5 py-4 text-center font-medium text-ink shadow-sm transition hover:scale-[1.02] hover:text-accent focus-visible:scale-[1.02] focus-visible:text-accent">Blog</a></li>',
    );
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
      '<p class="text-sm text-muted">© 2026 &lt;b&gt;Jane&lt;/b&gt;</p>',
    );
  });
});
