# link-free JSON-LD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit a schema.org `ProfilePage` JSON-LD block (derived entirely from existing config) whenever the header contains a profile block.

**Architecture:** New pure function `buildJsonLd(sections)` in `src/engine/jsonld.ts` returns the full `<script type="application/ld+json">…</script>` string or null. `renderPage` includes it in `<head>`. JSON is stringified with `<` escaped as `\u003c`; relative asset image paths are absolutized against `canonicalUrl`.

**Tech Stack:** TypeScript, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-04-link-free-json-ld-design.md`

---

### Task 1: `buildJsonLd`

**Files:**
- Create: `src/engine/jsonld.ts`
- Test: `tests/engine/jsonld.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/engine/jsonld.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/engine/jsonld.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/engine/jsonld.ts`**

```ts
import type { ValidatedBlock } from "../components/registry.js";
import type { Sections } from "./loadSections.js";

function findBlock(blocks: ValidatedBlock[] | null, component: string): ValidatedBlock | undefined {
  return blocks?.find((b) => b.component === component);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Absolutize a relative (post-asset-rewrite) value against the canonical URL. */
function absolutize(value: string, canonicalUrl: string | undefined): string {
  if (!canonicalUrl || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `${canonicalUrl.replace(/\/$/, "")}/${value.replace(/^\.\//, "")}`;
}

/**
 * schema.org ProfilePage JSON-LD for the page, or null when there is no
 * profile block. Structured data only — not executable JavaScript.
 */
export function buildJsonLd(sections: Sections): string | null {
  const profile = findBlock(sections.header, "profile");
  const name = profile && asString(profile.name);
  if (!profile || !name) return null;

  const entity: Record<string, unknown> = { "@type": "Person", name };

  const image = asString(profile.image);
  if (image) entity.image = absolutize(image, sections.site.canonicalUrl);

  const bio = asString(profile.bio);
  if (bio) entity.description = bio;

  if (sections.site.canonicalUrl) entity.url = sections.site.canonicalUrl;

  const socials = findBlock(sections.header, "socials");
  const sameAs = Array.isArray(socials?.links)
    ? (socials.links as unknown[])
        .map((l) => asString((l as Record<string, unknown>).url))
        .filter((u): u is string => Boolean(u))
    : [];
  if (sameAs.length > 0) entity.sameAs = sameAs;

  const data = { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: entity };
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/engine/jsonld.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/engine/jsonld.ts tests/engine/jsonld.test.ts
git commit -m "feat: buildJsonLd (ProfilePage structured data)"
```

---

### Task 2: renderPage integration + verification

**Files:**
- Modify: `src/engine/renderPage.ts`
- Test: `tests/engine/renderPage.test.ts` (add 2 tests)

- [ ] **Step 1: Add the failing tests** — append to the describe block in `tests/engine/renderPage.test.ts`:

```ts
  it("includes a parseable JSON-LD block when a profile exists", () => {
    const html = renderPage(full);
    const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(match, "JSON-LD block present").not.toBeNull();
    const data = JSON.parse(match![1]);
    expect(data["@type"]).toBe("ProfilePage");
    expect(data.mainEntity.name).toBe("Jane");
    expect(data.mainEntity.sameAs).toEqual(["https://github.com/jane"]);
  });

  it("omits JSON-LD when there is no profile block", () => {
    const html = renderPage({ site: {}, theme: { theme: "light" }, header: null, body: null, footer: null });
    expect(html).not.toContain("application/ld+json");
  });
```

Note: the `full` fixture's profile has no bio and the site has a canonicalUrl — check the fixture and adjust the expected sameAs/url assertions to match it exactly. The regex uses a non-greedy match; there is only ever one ld+json block.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/engine/renderPage.test.ts`
Expected: FAIL — no ld+json in output yet

- [ ] **Step 3: Update `src/engine/renderPage.ts`**

Add import:

```ts
import { buildJsonLd } from "./jsonld.js";
```

After the `styles` array definition, add:

```ts
  const jsonLd = buildJsonLd(sections);
```

And in the `parts` array, insert the block between the styles and `</head>`:

```ts
    ...styles,
    ...(jsonLd ? [`  ${jsonLd}`] : []),
    "</head>",
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test && pnpm typecheck`
Expected: full suite PASS (103 tests — 94 + 7 jsonld + 2 renderPage), typecheck clean.

- [ ] **Step 5: Smoke-test**

```bash
pnpm build && node dist/cli.js build --dir example --out example/dist
grep -o 'application/ld+json' example/dist/index.html
grep -c '<script' example/dist/index.html   # expect: 1 (the ld+json block; not executable JS)
```

Confirm the block contains `"@type": "ProfilePage"`, Jane Doe's name, and the sameAs URLs.

- [ ] **Step 6: Commit**

```bash
git add src/engine/renderPage.ts tests/engine/renderPage.test.ts
git commit -m "feat: emit ProfilePage JSON-LD in head"
```
