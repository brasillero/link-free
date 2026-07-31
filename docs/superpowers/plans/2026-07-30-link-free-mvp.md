# link-free MVP (Engine/Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `link-free` CLI core: read optional `link.site/header/body/footer.json` files, validate them with zod through a component registry, and emit one semantic, SEO-first, zero-JS `index.html`.

**Architecture:** One-way flow `discover → validate → render → write`. JSON blocks declare a `component` name; a registry maps name → `{ schema, render }` where `render` is a pure function returning an HTML string. Zod schemas are the single source of truth for validation and TS types. Missing files = omitted sections; any validation error = exit 1 with a precise message and no output file.

**Tech Stack:** TypeScript (strict), Node >= 18 ESM, zod v3 (only runtime dep, bundled), tsup (build), vitest (test), pnpm.

**Spec:** `docs/superpowers/specs/2026-07-30-link-free-mvp-design.md`

---

## File Structure

```
package.json, tsconfig.json, tsup.config.ts, .gitignore, README.md
src/
  cli.ts                    # argv parsing (node:util parseArgs), exit codes
  escapeHtml.ts             # single escaping helper
  schema/
    blocks.ts               # zod schemas + inferred types for the 4 block kinds, ICON_NAMES
    files.ts                # siteFileSchema + section wrapper schema
  components/
    icons.ts                # IconName → inline SVG string
    profile.ts              # renderProfile
    socials.ts              # renderSocials
    link.ts                 # renderLink (renders <li>)
    text.ts                 # renderText
    registry.ts             # name → { schema, render }, COMPONENT_NAMES, renderBlock
  engine/
    loadSections.ts         # discover + validate files → Sections; LoadError
    renderPage.ts           # Sections → full HTML document string
    build.ts                # loadSections + renderPage + write dist/index.html
tests/
  escapeHtml.test.ts
  schema/blocks.test.ts
  schema/files.test.ts
  components/icons.test.ts
  components/render.test.ts
  engine/loadSections.test.ts
  engine/renderPage.test.ts
  build.test.ts             # end-to-end via build() on tmp fixture dirs
example/
  link.site.json, link.header.json, link.body.json, link.footer.json
```

Notes for implementers:

- Icon artwork is MVP-quality (stroke-based, lucide-style approximations). Recognizable, valid SVG; visual polish is future scope. Tests assert structure, not artwork.
- All imports use `.js` suffix (ESM/NodeNext style) even though sources are `.ts`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "link-free",
  "version": "0.0.1",
  "description": "Tiny link-in-bio static HTML generator — semantic, SEO-first, zero JS",
  "type": "module",
  "bin": {
    "link-free": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "dev": "vitest"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsup": "^8.1.0",
    "typescript": "^5.5.4",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["src", "tests", "example", "tsup.config.ts"]
}
```

- [ ] **Step 3: Write `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
example/dist/
```

- [ ] **Step 5: Write `README.md`**

```markdown
# link-free

Tiny, open link-in-bio generator. Drop JSON files in a repo, run one command,
get a single static, semantic, SEO-first HTML page with zero JavaScript.

## Usage

```sh
npx link-free build            # scan cwd, write dist/index.html
npx link-free build --dir . --out dist
```

Config files (all optional; missing file = section omitted):

| File | Purpose |
| --- | --- |
| `link.site.json` | Page-level SEO: title, description, lang, canonicalUrl, ogImage |
| `link.header.json` | `profile` (image, name, bio) + `socials` (icon links) blocks |
| `link.body.json` | `link` blocks (title, url, description) |
| `link.footer.json` | `text` blocks |

See `example/` for a complete config. Design spec: `docs/superpowers/specs/2026-07-30-link-free-mvp-design.md`.
```

- [ ] **Step 6: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsup.config.ts .gitignore README.md
git commit -m "chore: project scaffold (tsup, vitest, zod, typescript)"
```

---

### Task 2: `escapeHtml` helper

**Files:**
- Create: `src/escapeHtml.ts`
- Test: `tests/escapeHtml.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/escapeHtml.test.ts
import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/escapeHtml.js";

describe("escapeHtml", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`<script>"x"&'y'`)).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Jane Doe")).toBe("Jane Doe");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/escapeHtml.test.ts`
Expected: FAIL — cannot find module `../src/escapeHtml.js`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/escapeHtml.ts
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/escapeHtml.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/escapeHtml.ts tests/escapeHtml.test.ts
git commit -m "feat: escapeHtml helper"
```

---

### Task 3: Block schemas (`schema/blocks.ts`)

**Files:**
- Create: `src/schema/blocks.ts`
- Test: `tests/schema/blocks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/schema/blocks.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/schema/blocks.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```ts
// src/schema/blocks.ts
import { z } from "zod";

export const ICON_NAMES = [
  "github",
  "x",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "mastodon",
  "website",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const profileBlockSchema = z
  .object({
    component: z.literal("profile"),
    image: z.string().url(),
    name: z.string().min(1),
    bio: z.string().optional(),
  })
  .strip();

export const socialLinkSchema = z
  .object({
    icon: z.enum(ICON_NAMES),
    url: z.string().url(),
    label: z.string().min(1),
  })
  .strip();

export const socialsBlockSchema = z
  .object({
    component: z.literal("socials"),
    links: z.array(socialLinkSchema).min(1),
  })
  .strip();

export const linkBlockSchema = z
  .object({
    component: z.literal("link"),
    title: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional(),
  })
  .strip();

export const textBlockSchema = z
  .object({
    component: z.literal("text"),
    text: z.string().min(1),
  })
  .strip();

export type ProfileBlock = z.infer<typeof profileBlockSchema>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export type SocialsBlock = z.infer<typeof socialsBlockSchema>;
export type LinkBlock = z.infer<typeof linkBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/schema/blocks.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/schema/blocks.ts tests/schema/blocks.test.ts
git commit -m "feat: block schemas with zod (profile, socials, link, text)"
```

---

### Task 4: File schemas (`schema/files.ts`)

**Files:**
- Create: `src/schema/files.ts`
- Test: `tests/schema/files.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/schema/files.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/schema/files.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```ts
// src/schema/files.ts
import { z } from "zod";

export const siteFileSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lang: z.string().optional(),
    canonicalUrl: z.string().url().optional(),
    ogImage: z.string().url().optional(),
  })
  .strip();

export type SiteFile = z.infer<typeof siteFileSchema>;

/** Loose wrapper: per-block validation happens in loadSections via the registry. */
export const sectionFileSchema = z.object({
  blocks: z.array(z.record(z.unknown())),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/schema/files.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/schema/files.ts tests/schema/files.test.ts
git commit -m "feat: site + section file schemas"
```

---

### Task 5: Icon set (`components/icons.ts`)

**Files:**
- Create: `src/components/icons.ts`
- Test: `tests/components/icons.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/icons.test.ts
import { describe, expect, it } from "vitest";
import { ICON_NAMES } from "../../src/schema/blocks.js";
import { ICONS } from "../../src/components/icons.js";

describe("ICONS", () => {
  it("has an inline SVG for every IconName", () => {
    for (const name of ICON_NAMES) {
      expect(ICONS[name], `missing icon: ${name}`).toMatch(/^<svg[\s\S]*<\/svg>$/);
      expect(ICONS[name]).toContain('aria-hidden="true"');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/icons.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/icons.ts
import type { IconName } from "../schema/blocks.js";

const svg = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS: Record<IconName, string> = {
  github: svg(
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  ),
  x: svg('<path d="M4 4l16 16"/><path d="M20 4L4 20"/>'),
  instagram: svg(
    '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  ),
  linkedin: svg(
    '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4V8h4v1.5A6 6 0 0 1 16 8z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
  ),
  youtube: svg(
    '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  ),
  tiktok: svg('<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>'),
  mastodon: svg('<path d="M4 20V9a4 4 0 0 1 8 0v11"/><path d="M12 20V9a4 4 0 0 1 8 0v11"/>'),
  website: svg(
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  ),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/icons.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/components/icons.ts tests/components/icons.test.ts
git commit -m "feat: inline SVG icon set (8 icons)"
```

---

### Task 6: Component renderers

**Files:**
- Create: `src/components/profile.ts`
- Create: `src/components/socials.ts`
- Create: `src/components/link.ts`
- Create: `src/components/text.ts`
- Test: `tests/components/render.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/render.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/render.test.ts`
Expected: FAIL — cannot find modules

- [ ] **Step 3: Write minimal implementations**

```ts
// src/components/profile.ts
import { escapeHtml } from "../escapeHtml.js";
import type { ProfileBlock } from "../schema/blocks.js";

export function renderProfile({ image, name, bio }: ProfileBlock): string {
  const bioHtml = bio ? `\n  <p>${escapeHtml(bio)}</p>` : "";
  return `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="96" height="96">\n  <h1>${escapeHtml(name)}</h1>${bioHtml}`;
}
```

```ts
// src/components/socials.ts
import { escapeHtml } from "../escapeHtml.js";
import type { SocialsBlock } from "../schema/blocks.js";
import { ICONS } from "./icons.js";

export function renderSocials({ links }: SocialsBlock): string {
  const items = links
    .map(
      (l) =>
        `    <a href="${escapeHtml(l.url)}" rel="me" aria-label="${escapeHtml(l.label)}">${ICONS[l.icon]}</a>`,
    )
    .join("\n");
  return `<nav aria-label="Social links">\n${items}\n  </nav>`;
}
```

```ts
// src/components/link.ts
import { escapeHtml } from "../escapeHtml.js";
import type { LinkBlock } from "../schema/blocks.js";

export function renderLink({ title, url, description }: LinkBlock): string {
  const desc = description ? `<small>${escapeHtml(description)}</small>` : "";
  return `<li><a href="${escapeHtml(url)}">${escapeHtml(title)}</a>${desc}</li>`;
}
```

```ts
// src/components/text.ts
import { escapeHtml } from "../escapeHtml.js";
import type { TextBlock } from "../schema/blocks.js";

export function renderText({ text }: TextBlock): string {
  return `<p>${escapeHtml(text)}</p>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/render.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/profile.ts src/components/socials.ts src/components/link.ts src/components/text.ts tests/components/render.test.ts
git commit -m "feat: component renderers (profile, socials, link, text)"
```

---

### Task 7: Component registry

**Files:**
- Create: `src/components/registry.ts`
- Test: `tests/components/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/registry.test.ts
import { describe, expect, it } from "vitest";
import { COMPONENT_NAMES, registry, renderBlock } from "../../src/components/registry.js";

describe("registry", () => {
  it("registers the 4 MVP components", () => {
    expect([...COMPONENT_NAMES].sort()).toEqual(["link", "profile", "socials", "text"]);
    for (const name of COMPONENT_NAMES) {
      expect(registry[name].schema).toBeDefined();
      expect(typeof registry[name].render).toBe("function");
    }
  });

  it("renderBlock dispatches by component name", () => {
    const html = renderBlock({ component: "text", text: "hi" });
    expect(html).toBe("<p>hi</p>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/registry.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/registry.ts
import type { ZodTypeAny } from "zod";
import {
  linkBlockSchema,
  profileBlockSchema,
  socialsBlockSchema,
  textBlockSchema,
  type LinkBlock,
  type ProfileBlock,
  type SocialsBlock,
  type TextBlock,
} from "../schema/blocks.js";
import { renderLink } from "./link.js";
import { renderProfile } from "./profile.js";
import { renderSocials } from "./socials.js";
import { renderText } from "./text.js";

/** A validated block as it flows from loadSections to renderPage. */
export type ValidatedBlock = { component: string } & Record<string, unknown>;

interface Component {
  schema: ZodTypeAny;
  render: (props: unknown) => string;
}

export const registry: Record<string, Component> = {
  profile: { schema: profileBlockSchema, render: (p) => renderProfile(p as ProfileBlock) },
  socials: { schema: socialsBlockSchema, render: (p) => renderSocials(p as SocialsBlock) },
  link: { schema: linkBlockSchema, render: (p) => renderLink(p as LinkBlock) },
  text: { schema: textBlockSchema, render: (p) => renderText(p as TextBlock) },
};

export const COMPONENT_NAMES = Object.keys(registry);

export function renderBlock(block: ValidatedBlock): string {
  return registry[block.component].render(block);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/registry.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/registry.ts tests/components/registry.test.ts
git commit -m "feat: component registry with renderBlock dispatch"
```

---

### Task 8: `loadSections` (discover + validate)

**Files:**
- Create: `src/engine/loadSections.ts`
- Test: `tests/engine/loadSections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/loadSections.test.ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSections, LoadError } from "../../src/engine/loadSections.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "link-free-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const write = (name: string, data: unknown) =>
  writeFile(join(dir, name), typeof data === "string" ? data : JSON.stringify(data), "utf8");

describe("loadSections", () => {
  it("returns null sections when files are absent", async () => {
    await write("link.body.json", {
      blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }],
    });
    const sections = await loadSections(dir);
    expect(sections.header).toBeNull();
    expect(sections.footer).toBeNull();
    expect(sections.site).toEqual({});
    expect(sections.body).toHaveLength(1);
  });

  it("throws when all four files are missing", async () => {
    await expect(loadSections(dir)).rejects.toThrow(/no link\.\*\.json files found/);
  });

  it("throws on malformed JSON, naming the file", async () => {
    await write("link.body.json", "{ not json");
    await expect(loadSections(dir)).rejects.toThrow(/link\.body\.json.*invalid JSON/);
  });

  it("throws on unknown component, listing valid names", async () => {
    await write("link.body.json", { blocks: [{ component: "carousel" }] });
    await expect(loadSections(dir)).rejects.toThrow(
      /blocks\[0\]: unknown component "carousel".*profile/,
    );
  });

  it("throws with zod issue path on schema failure", async () => {
    await write("link.body.json", {
      blocks: [{ component: "link", title: "Blog", url: "nope" }],
    });
    await expect(loadSections(dir)).rejects.toThrow(/blocks\[0\]\.url/);
  });

  it("validates blocks through the registry and strips unknown keys", async () => {
    await write("link.footer.json", {
      blocks: [{ component: "text", text: "hi", future: 1 }],
    });
    const sections = await loadSections(dir);
    expect(sections.footer).toEqual([{ component: "text", text: "hi" }]);
  });

  it("validates link.site.json when present", async () => {
    await write("link.site.json", { title: "Jane", canonicalUrl: "bad" });
    await expect(loadSections(dir)).rejects.toThrow(LoadError);
  });

  it("rejects a component that is not allowed in that section", async () => {
    await write("link.header.json", {
      blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }],
    });
    await expect(loadSections(dir)).rejects.toThrow(
      /link\.header\.json → blocks\[0\]: component "link" not allowed here \(valid: profile, socials\)/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/engine/loadSections.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/loadSections.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sectionFileSchema, siteFileSchema, type SiteFile } from "../schema/files.js";
import { COMPONENT_NAMES, registry, type ValidatedBlock } from "../components/registry.js";

export class LoadError extends Error {}

const SECTION_NAMES = ["header", "body", "footer"] as const;
type SectionName = (typeof SECTION_NAMES)[number];

/** Which components each section file accepts (spec §4.7). */
const SECTION_COMPONENTS: Record<SectionName, string[]> = {
  header: ["profile", "socials"],
  body: ["link"],
  footer: ["text"],
};

export interface Sections {
  site: SiteFile;
  header: ValidatedBlock[] | null;
  body: ValidatedBlock[] | null;
  footer: ValidatedBlock[] | null;
}

async function readJsonFile(path: string): Promise<unknown | null> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return null; // missing file → section omitted
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new LoadError(`${path}: invalid JSON — ${(err as Error).message}`);
  }
}

function validateBlocks(raw: unknown, section: SectionName): ValidatedBlock[] {
  const fileName = `link.${section}.json`;
  const wrapper = sectionFileSchema.safeParse(raw);
  if (!wrapper.success) {
    throw new LoadError(`${fileName}: expected an object with a "blocks" array`);
  }
  return wrapper.data.blocks.map((block, i) => {
    const component = block.component;
    if (typeof component !== "string" || !(component in registry)) {
      throw new LoadError(
        `${fileName} → blocks[${i}]: unknown component "${String(component)}" (valid: ${COMPONENT_NAMES.join(", ")})`,
      );
    }
    if (!SECTION_COMPONENTS[section].includes(component)) {
      throw new LoadError(
        `${fileName} → blocks[${i}]: component "${component}" not allowed here (valid: ${SECTION_COMPONENTS[section].join(", ")})`,
      );
    }
    const result = registry[component].schema.safeParse(block);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${fileName} → blocks[${i}].${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new LoadError(issues);
    }
    return result.data as ValidatedBlock;
  });
}

export async function loadSections(dir: string): Promise<Sections> {
  const siteRaw = await readJsonFile(join(dir, "link.site.json"));

  const sections: Record<SectionName, ValidatedBlock[] | null> = {
    header: null,
    body: null,
    footer: null,
  };
  for (const name of SECTION_NAMES) {
    const raw = await readJsonFile(join(dir, `link.${name}.json`));
    if (raw != null) {
      sections[name] = validateBlocks(raw, name);
    }
  }

  if (siteRaw == null && SECTION_NAMES.every((n) => sections[n] == null)) {
    throw new LoadError(`no link.*.json files found in ${dir}`);
  }

  let site: SiteFile = {};
  if (siteRaw != null) {
    const parsed = siteFileSchema.safeParse(siteRaw);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `link.site.json → ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new LoadError(issues);
    }
    site = parsed.data;
  }

  return { site, ...sections };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/engine/loadSections.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/engine/loadSections.ts tests/engine/loadSections.test.ts
git commit -m "feat: loadSections discovery + registry-based validation"
```

---

### Task 9: `renderPage` (HTML document + SEO)

**Files:**
- Create: `src/engine/renderPage.ts`
- Test: `tests/engine/renderPage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/renderPage.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/engine/renderPage.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/renderPage.ts
import { renderBlock, type ValidatedBlock } from "../components/registry.js";
import { escapeHtml } from "../escapeHtml.js";
import type { Sections } from "./loadSections.js";

function findProp(blocks: ValidatedBlock[] | null, component: string, prop: string): string | undefined {
  const block = blocks?.find((b) => b.component === component);
  const value = block?.[prop];
  return typeof value === "string" ? value : undefined;
}

function wrapSection(tag: string, blocks: ValidatedBlock[] | null): string | null {
  if (!blocks || blocks.length === 0) return null;
  const body = blocks.map(renderBlock).join("\n  ");
  return `<${tag}>\n  ${body}\n</${tag}>`;
}

export function renderPage(sections: Sections): string {
  const { site, header, body, footer } = sections;

  const title = site.title || findProp(header, "profile", "name") || "Links";
  const description = site.description || findProp(header, "profile", "bio");

  const meta: string[] = [
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(title)}</title>`,
  ];
  if (description) meta.push(`  <meta name="description" content="${escapeHtml(description)}">`);
  if (site.canonicalUrl) meta.push(`  <link rel="canonical" href="${escapeHtml(site.canonicalUrl)}">`);
  meta.push(`  <meta property="og:title" content="${escapeHtml(title)}">`);
  if (description) meta.push(`  <meta property="og:description" content="${escapeHtml(description)}">`);
  meta.push('  <meta property="og:type" content="profile">');
  if (site.ogImage) meta.push(`  <meta property="og:image" content="${escapeHtml(site.ogImage)}">`);
  meta.push('  <meta name="twitter:card" content="summary">');
  meta.push('  <meta name="robots" content="index, follow">');

  // Body links are wrapped in a real list so they are crawlable without JS.
  const bodyHtml =
    body && body.length > 0
      ? `<main>\n  <ul>\n    ${body.map(renderBlock).join("\n    ")}\n  </ul>\n</main>`
      : null;

  const parts = [
    "<!doctype html>",
    `<html lang="${escapeHtml(site.lang ?? "en")}">`,
    "<head>",
    ...meta,
    "</head>",
    "<body>",
    wrapSection("header", header),
    bodyHtml,
    wrapSection("footer", footer),
    "</body>",
    "</html>",
  ];

  return parts.filter((p): p is string => p != null).join("\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/engine/renderPage.test.ts`
Expected: PASS (9 tests — 5 original + 4 added in review: empty-array omission, empty-string title fallback, page-level escaping, bio description fallback + og:description)

- [ ] **Step 5: Commit**

```bash
git add src/engine/renderPage.ts tests/engine/renderPage.test.ts
git commit -m "feat: renderPage with semantic HTML + SEO meta defaults"
```

---

### Task 10: `build()` + CLI entry

**Files:**
- Create: `src/engine/build.ts`
- Create: `src/cli.ts`
- Test: `tests/build.test.ts`

- [ ] **Step 1: Write the failing end-to-end test**

```ts
// tests/build.test.ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { build } from "../src/engine/build.js";

let dir: string;
let out: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "link-free-src-"));
  out = await mkdtemp(join(tmpdir(), "link-free-out-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

const write = (name: string, data: unknown) =>
  writeFile(join(dir, name), JSON.stringify(data), "utf8");

describe("build", () => {
  it("writes a complete index.html from a full fixture", async () => {
    await write("link.site.json", { title: "Jane — Links", description: "all my links" });
    await write("link.header.json", {
      blocks: [
        { component: "profile", image: "https://example.com/a.png", name: "Jane" },
        {
          component: "socials",
          links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }],
        },
      ],
    });
    await write("link.body.json", {
      blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }],
    });
    await write("link.footer.json", { blocks: [{ component: "text", text: "© 2026 Jane" }] });

    const outPath = await build(dir, join(out, "dist"));
    const html = await readFile(outPath, "utf8");

    expect(outPath).toBe(join(out, "dist", "index.html"));
    expect(html).toContain("<title>Jane — Links</title>");
    expect(html).toContain("<h1>Jane</h1>");
    expect(html).toContain('href="https://github.com/jane"');
    expect(html).toContain('href="https://b.dev"');
    expect(html).toContain("© 2026 Jane");
  });

  it("does not write any output file on validation error", async () => {
    await write("link.body.json", { blocks: [{ component: "link", title: "x", url: "bad" }] });
    await expect(build(dir, join(out, "dist"))).rejects.toThrow(/blocks\[0\]\.url/);
    await expect(readFile(join(out, "dist", "index.html"), "utf8")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/build.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementations**

```ts
// src/engine/build.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadSections } from "./loadSections.js";
import { renderPage } from "./renderPage.js";

export async function build(dir: string, outDir: string): Promise<string> {
  const sections = await loadSections(dir);
  const html = renderPage(sections);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await writeFile(outPath, html, "utf8");
  return outPath;
}
```

```ts
// src/cli.ts
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "./engine/build.js";
import { LoadError } from "./engine/loadSections.js";

const USAGE = "Usage: link-free build [--dir <path>] [--out <path>]";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: "string", default: "." },
      out: { type: "string", default: "dist" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const command = positionals[0];

  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (command !== "build") {
    console.error(USAGE);
    process.exit(1);
  }

  try {
    const outPath = await build(resolve(values.dir), resolve(values.out));
    console.log(`built ${outPath}`);
  } catch (err) {
    if (err instanceof LoadError) {
      console.error(`error: ${err.message}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  }
}

await main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/build.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all tests PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/build.ts src/cli.ts tests/build.test.ts
git commit -m "feat: build pipeline + CLI entry (link-free build)"
```

---

### Task 11: Example fixture + real CLI smoke test

**Files:**
- Create: `example/link.site.json`
- Create: `example/link.header.json`
- Create: `example/link.body.json`
- Create: `example/link.footer.json`

- [ ] **Step 1: Write the example configs**

```json
// example/link.site.json
{
  "title": "Jane Doe — Links",
  "description": "All of Jane Doe's links in one place.",
  "lang": "en",
  "canonicalUrl": "https://links.janedoe.dev",
  "ogImage": "https://links.janedoe.dev/og.png"
}
```

```json
// example/link.header.json
{
  "blocks": [
    {
      "component": "profile",
      "image": "https://example.com/avatar.png",
      "name": "Jane Doe",
      "bio": "Engineer, writer, coffee enthusiast."
    },
    {
      "component": "socials",
      "links": [
        { "icon": "github", "url": "https://github.com/janedoe", "label": "GitHub" },
        { "icon": "x", "url": "https://x.com/janedoe", "label": "X" },
        { "icon": "website", "url": "https://janedoe.dev", "label": "Website" }
      ]
    }
  ]
}
```

```json
// example/link.body.json
{
  "blocks": [
    { "component": "link", "title": "My blog", "url": "https://blog.janedoe.dev", "description": "Long-form writing" },
    { "component": "link", "title": "Talks", "url": "https://janedoe.dev/talks" },
    { "component": "link", "title": "Contact", "url": "mailto:jane@janedoe.dev" }
  ]
}
```

```json
// example/link.footer.json
{
  "blocks": [
    { "component": "text", "text": "© 2026 Jane Doe — built with link-free" }
  ]
}
```

Note: `mailto:` is not a valid `z.string().url()`? — it IS valid (`new URL("mailto:...")` parses). Keep it; if the smoke test proves otherwise, change the Contact entry to an `https://` URL.

- [ ] **Step 2: Bundle the CLI**

Run: `pnpm build`
Expected: `dist/cli.js` emitted, first line `#!/usr/bin/env node`.

- [ ] **Step 3: Smoke-test the CLI against the example**

Run: `node dist/cli.js build --dir example --out example/dist && head -20 example/dist/index.html`
Expected: `built …/example/dist/index.html`, and the HTML head shows `<title>Jane Doe — Links</title>`, meta description, canonical, og tags.

- [ ] **Step 4: Smoke-test error handling**

Run: `node dist/cli.js build --dir /nonexistent-path-xyz; echo "exit=$?"`
Expected: error message `no link.*.json files found`, `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add example/
git commit -m "docs: runnable example config + CLI smoke verified"
```

---

### Task 12: Final verification

- [ ] **Step 1: Full clean run**

Run: `rm -rf node_modules dist && pnpm install && pnpm test && pnpm typecheck && pnpm build`
Expected: install clean, all 48 tests PASS, no type errors, bundle emitted.

- [ ] **Step 2: Confirm output contract against spec**

Re-read `docs/superpowers/specs/2026-07-30-link-free-mvp-design.md` sections 4–7 and confirm `example/dist/index.html` matches: semantic tags, conditional meta, omitted sections, escaping.

- [ ] **Step 3: Final commit (if anything changed)**

```bash
git add -A
git commit -m "chore: final MVP verification" || true
```
