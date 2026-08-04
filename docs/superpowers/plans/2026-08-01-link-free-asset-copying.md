# link-free Asset Copying Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `profile.image`, `site.ogImage`, and `tokens.backgroundImage` accept local file paths; the build copies them to `<out>/assets/` and rewrites references in the emitted HTML.

**Architecture:** A shared `assetRefSchema` (non-empty, no `<`) replaces `.url()` on the three fields. A new `processAssets(sections, dir, outDir)` step in `src/engine/assets.ts` runs between `loadSections` and `renderPage`: local refs are resolved against `--dir`, existence-checked, copied, and rewritten to `assets/<basename>`; absolute URLs pass through. Missing files, `..` traversal, and basename collisions are hard `LoadError`s before any output is written.

**Tech Stack:** TypeScript, node:fs/promises, node:path, zod v3, vitest.

**Spec:** `docs/superpowers/specs/2026-08-01-link-free-asset-copying-design.md`

---

### Task 1: Relax the three fields to asset references

**Files:**
- Create: `src/schema/common.ts`
- Modify: `src/schema/blocks.ts` (profileBlockSchema.image)
- Modify: `src/schema/files.ts` (siteFileSchema.ogImage, themeConfigSchema.tokens.backgroundImage)
- Test: `tests/schema/assetRef.test.ts` (new), update `tests/schema/blocks.test.ts` + `tests/schema/files.test.ts` + `tests/schema/themeConfig.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/schema/assetRef.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assetRefSchema } from "../../src/schema/common.js";

describe("assetRefSchema", () => {
  it("accepts absolute URLs", () => {
    expect(assetRefSchema.parse("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("accepts relative local paths", () => {
    expect(assetRefSchema.parse("./avatar.png")).toBe("./avatar.png");
    expect(assetRefSchema.parse("images/bg.jpg")).toBe("images/bg.jpg");
  });

  it("rejects empty strings", () => {
    expect(() => assetRefSchema.parse("")).toThrow();
  });

  it("rejects '<' (style-breakout hardening)", () => {
    expect(() => assetRefSchema.parse("./a</style>.png")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/schema/assetRef.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/schema/common.ts`**

```ts
import { z } from "zod";

/**
 * Asset reference: an absolute URL (passed through) or a local path relative
 * to the config directory (copied into the output at build time).
 */
export const assetRefSchema = z.string().min(1).regex(/^[^<]+$/, "must not contain '<'");
```

- [ ] **Step 4: Relax the three fields**

In `src/schema/blocks.ts`: add `import { assetRefSchema } from "./common.js";` and in `profileBlockSchema` change `image: z.string().url(),` to `image: assetRefSchema,`.

In `src/schema/files.ts`: add `import { assetRefSchema } from "./common.js";`; in `siteFileSchema` change `ogImage: z.string().url().optional(),` to `ogImage: assetRefSchema.optional(),`; in the theme tokens change `backgroundImage: z.string().url().regex(/^[^<]+$/, "must not contain '<'").optional(),` to `backgroundImage: assetRefSchema.optional(),`.

- [ ] **Step 5: Update the tests that pinned URL-only behavior**

In `tests/schema/blocks.test.ts`, replace the "rejects an invalid image URL" test with:

```ts
  it("accepts a local image path", () => {
    const parsed = profileBlockSchema.parse({
      component: "profile",
      image: "./avatar.png",
      name: "Jane",
    });
    expect(parsed.image).toBe("./avatar.png");
  });
```

In `tests/schema/themeConfig.test.ts`, replace the "rejects a non-URL backgroundImage" test with:

```ts
  it("accepts a local backgroundImage path", () => {
    const parsed = themeConfigSchema.parse({ tokens: { backgroundImage: "./bg.jpg" } });
    expect(parsed.tokens?.backgroundImage).toBe("./bg.jpg");
  });
```

(The existing "rejects a backgroundImage containing '<'" test stays and still passes.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test && pnpm typecheck`
Expected: full suite PASS (81 tests — 77 + 4 new assetRef tests; two existing tests replaced in place, count unchanged for those), typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/schema/common.ts src/schema/blocks.ts src/schema/files.ts tests/schema/assetRef.test.ts tests/schema/blocks.test.ts tests/schema/themeConfig.test.ts
git commit -m "feat: assetRef schema (url or local path) for image fields"
```

---

### Task 2: `processAssets`

**Files:**
- Create: `src/engine/assets.ts`
- Test: `tests/engine/assets.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/engine/assets.test.ts`:

```ts
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { processAssets } from "../../src/engine/assets.js";
import type { Sections } from "../../src/engine/loadSections.js";

let dir: string;
let out: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-assets-src-"));
  out = await mkdtemp(join(tmpdir(), "lf-assets-out-"));
  await writeFile(join(dir, "avatar.png"), "png-bytes");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

const base: Sections = {
  site: {},
  theme: { theme: "light" },
  header: null,
  body: null,
  footer: null,
};

describe("processAssets", () => {
  it("copies a local profile image and rewrites the reference", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "./avatar.png", name: "Jane" }],
    };
    const result = await processAssets(sections, dir, out);
    expect(result.header?.[0].image).toBe("assets/avatar.png");
    await expect(readdir(join(out, "assets"))).resolves.toEqual(["avatar.png"]);
  });

  it("passes absolute URLs through untouched", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "https://cdn.example.com/a.png", name: "Jane" }],
    };
    const result = await processAssets(sections, dir, out);
    expect(result.header?.[0].image).toBe("https://cdn.example.com/a.png");
  });

  it("throws on a missing local file, naming the config field", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "./nope.png", name: "Jane" }],
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(
      /link\.header\.json → blocks\[0\]\.image: file not found: \.\/nope\.png/,
    );
  });

  it("rejects paths escaping the config directory", async () => {
    const sections: Sections = {
      ...base,
      header: [{ component: "profile", image: "../outside.png", name: "Jane" }],
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(/outside the config directory/);
  });

  it("throws on basename collisions between different source files", async () => {
    await mkdir(join(dir, "images"));
    await writeFile(join(dir, "a.png"), "one");
    await writeFile(join(dir, "images", "a.png"), "two");
    const sections: Sections = {
      ...base,
      site: { ogImage: "./a.png" },
      theme: { theme: "light", tokens: { backgroundImage: "images/a.png" } },
    };
    await expect(processAssets(sections, dir, out)).rejects.toThrow(/asset name collision/);
  });

  it("copies a file referenced twice only once", async () => {
    const sections: Sections = {
      ...base,
      site: { ogImage: "./avatar.png" },
      header: [{ component: "profile", image: "./avatar.png", name: "Jane" }],
    };
    const result = await processAssets(sections, dir, out);
    expect(result.header?.[0].image).toBe("assets/avatar.png");
    await expect(readdir(join(out, "assets"))).resolves.toEqual(["avatar.png"]);
  });

  it("absolutizes a local ogImage against canonicalUrl", async () => {
    const sections: Sections = {
      ...base,
      site: { ogImage: "./avatar.png", canonicalUrl: "https://links.jane.dev" },
    };
    const result = await processAssets(sections, dir, out);
    expect(result.site.ogImage).toBe("https://links.jane.dev/assets/avatar.png");
  });

  it("rewrites a local backgroundImage in theme tokens", async () => {
    const sections: Sections = {
      ...base,
      theme: { theme: "dark", tokens: { backgroundImage: "./avatar.png" } },
    };
    const result = await processAssets(sections, dir, out);
    expect(result.theme.tokens?.backgroundImage).toBe("assets/avatar.png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/engine/assets.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/engine/assets.ts`**

```ts
import { access, copyFile, mkdir } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { LoadError, type Sections } from "./loadSections.js";

function isRemote(ref: string): boolean {
  try {
    return Boolean(new URL(ref).protocol);
  } catch {
    return false;
  }
}

/**
 * Copies locally-referenced assets into `<outDir>/assets/` and rewrites the
 * references in the loaded sections. Absolute URLs pass through untouched.
 */
export async function processAssets(
  sections: Sections,
  dir: string,
  outDir: string,
): Promise<Sections> {
  const root = resolve(dir);
  const targetBySource = new Map<string, string>();
  const sourceByName = new Map<string, string>();

  async function relocate(ref: string, field: string): Promise<string> {
    if (isRemote(ref)) return ref;

    const abs = resolve(root, ref);
    if (abs !== root && !abs.startsWith(root + sep)) {
      throw new LoadError(`${field}: path "${ref}" resolves outside the config directory`);
    }

    const known = targetBySource.get(abs);
    if (known) return known;

    try {
      await access(abs);
    } catch {
      throw new LoadError(`${field}: file not found: ${ref} (resolved to ${abs})`);
    }

    const name = basename(abs);
    const prior = sourceByName.get(name);
    if (prior && prior !== abs) {
      throw new LoadError(`asset name collision: ${prior} and ${abs} both map to assets/${name}`);
    }
    sourceByName.set(name, abs);

    await mkdir(join(outDir, "assets"), { recursive: true });
    await copyFile(abs, join(outDir, "assets", name));

    const target = `assets/${name}`;
    targetBySource.set(abs, target);
    return target;
  }

  const site = { ...sections.site };
  if (site.ogImage) {
    const rewritten = await relocate(site.ogImage, "link.site.json → ogImage");
    site.ogImage =
      !isRemote(site.ogImage) && site.canonicalUrl
        ? `${site.canonicalUrl.replace(/\/$/, "")}/${rewritten}`
        : rewritten;
  }

  const theme: Sections["theme"] = {
    ...sections.theme,
    tokens: sections.theme.tokens ? { ...sections.theme.tokens } : undefined,
  };
  if (theme.tokens?.backgroundImage) {
    theme.tokens.backgroundImage = await relocate(
      theme.tokens.backgroundImage,
      "link.free.config.json → tokens.backgroundImage",
    );
  }

  const header = sections.header
    ? await Promise.all(
        sections.header.map(async (block, i) =>
          block.component === "profile" && typeof block.image === "string"
            ? { ...block, image: await relocate(block.image, `link.header.json → blocks[${i}].image`) }
            : block,
        ),
      )
    : null;

  return { ...sections, site, theme, header };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/engine/assets.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/engine/assets.ts tests/engine/assets.test.ts
git commit -m "feat: processAssets (copy local assets, rewrite refs)"
```

---

### Task 3: Wire `processAssets` into `build()`

**Files:**
- Modify: `src/engine/build.ts`
- Test: `tests/build.test.ts` (add integration test)

- [ ] **Step 1: Write the failing integration test** — append to the describe block in `tests/build.test.ts`:

```ts
  it("copies local assets and rewrites references in the output", async () => {
    await write("link.header.json", {
      blocks: [{ component: "profile", image: "./avatar.png", name: "Jane" }],
    });
    await writeFile(join(dir, "avatar.png"), "fake-png-bytes");

    const outPath = await build(dir, join(out, "dist"));
    const html = await readFile(outPath, "utf8");

    expect(html).toContain('src="assets/avatar.png"');
    await expect(readFile(join(out, "dist", "assets", "avatar.png"), "utf8")).resolves.toBe(
      "fake-png-bytes",
    );
  });

  it("fails without writing index.html when a referenced asset is missing", async () => {
    await write("link.header.json", {
      blocks: [{ component: "profile", image: "./missing.png", name: "Jane" }],
    });
    await expect(build(dir, join(out, "dist"))).rejects.toThrow(/file not found/);
    await expect(readFile(join(out, "dist", "index.html"), "utf8")).rejects.toThrow();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/build.test.ts`
Expected: FAIL — `./avatar.png` passes through verbatim, no assets dir

- [ ] **Step 3: Update `src/engine/build.ts`** — full new version:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { processAssets } from "./assets.js";
import { loadSections } from "./loadSections.js";
import { renderPage } from "./renderPage.js";

export async function build(dir: string, outDir: string): Promise<string> {
  const sections = await loadSections(dir);
  const withAssets = await processAssets(sections, dir, outDir);
  const html = renderPage(withAssets);
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await writeFile(outPath, html, "utf8");
  return outPath;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test && pnpm typecheck`
Expected: full suite PASS (91 tests — 81 + 8 assets + 2 build), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/build.ts tests/build.test.ts
git commit -m "feat: build pipeline copies local assets"
```

---

### Task 4: Example, README, final verification

**Files:**
- Create: `example/avatar.png` (tiny 1x1 PNG, binary)
- Modify: `example/link.header.json` (image → local path)
- Modify: `README.md` (asset references section)

- [ ] **Step 1: Create the example avatar (1x1 transparent PNG)**

Run:
```bash
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" | base64 -d > example/avatar.png
```

Verify: `file example/avatar.png` reports PNG image data (or `ls -la` shows ~67 bytes).

- [ ] **Step 2: Point the example at the local avatar**

In `example/link.header.json`, change the profile block's `"image"` value from `"https://example.com/avatar.png"` to `"./avatar.png"`.

- [ ] **Step 3: Document asset references in README.md** — add to the Theming section's end (or as its own short section after it):

```markdown
## Local assets

Image fields (`profile.image`, `ogImage`, `backgroundImage`) accept either an
absolute URL or a local path relative to your config directory (e.g.
`./avatar.png`). Local files are copied into `dist/assets/` at build time and
references are rewritten automatically. A missing file or a path outside the
config directory fails the build with a clear error.
```

- [ ] **Step 4: Full clean verification**

Run: `rm -rf node_modules dist example/dist && pnpm install && pnpm test && pnpm typecheck && pnpm build`
Expected: install clean, 91/91 tests PASS, no type errors, `dist/cli.js` emitted.

- [ ] **Step 5: Smoke-test the example**

```bash
node dist/cli.js build --dir example --out example/dist
ls example/dist/assets/
grep -o 'src="assets/avatar.png"' example/dist/index.html
```

Expected: build succeeds, `avatar.png` in `example/dist/assets/`, HTML references `assets/avatar.png`.

- [ ] **Step 6: Commit**

```bash
git add example/avatar.png example/link.header.json README.md
git commit -m "docs: local-asset example + README section"
```

---

## Notes for reviewers

- The three relaxed fields (`profile.image`, `ogImage`, `backgroundImage`) no longer require absolute URLs; `socials` link urls and body `link` urls still require `.url()` (unchanged).
- `isRemote` treats any scheme-qualified value as remote; on Windows a path like `C:\img\a.png` parses with scheme `c:` and therefore passes through as "remote". Documented expectation: local refs are forward-slash relative paths.
- `ogImage` is absolutized against `canonicalUrl` only when both are present; without `canonicalUrl` a local ogImage stays relative (crawler-visible limitation, accepted in spec).
- `processAssets` copies before `renderPage` runs; renderPage is pure, so the no-partial-index.html rule is preserved.
