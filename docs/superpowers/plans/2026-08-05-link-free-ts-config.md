# link-free TypeScript Config (v0.2.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace JSON configs with TypeScript modules (`site/header/body/footer/config.link.ts`), loaded via bundled jiti, with package-shipped types and a framework-style `init` (package.json + tsconfig + starter .ts files). Version 0.2.0.

**Architecture:** jiti loads each config module's default export; the existing zod validation, registry, render pipeline, and error formats are untouched. Types are `z.infer` of the existing file schemas, exported from a new `src/index.ts` built as a second tsup entry with dts. JSON loading, the schemas/ generator, and vite-node/zod-to-json-schema devDeps are removed.

**Tech Stack:** TypeScript, jiti (bundled), zod v3, tsup (dual entry + dts), vitest.

**Spec:** `docs/superpowers/specs/2026-08-05-link-free-ts-config-design.md`

**Key insight for fixtures:** jiti transpiles `import type` and `satisfies` away at load time, so test fixtures and the example can use full typed syntax without the package being installed.

---

### Task 1: jiti loader + loadSections migration

**Files:**
- Modify: `package.json` (add jiti devDep)
- Create: `src/engine/loadModule.ts`
- Modify: `src/engine/loadSections.ts`
- Test: `tests/engine/loadModule.test.ts` (new), rewrite `tests/engine/loadSections.test.ts`

- [ ] **Step 1: Install jiti**

Run: `pnpm add -D jiti`
Expected: jiti v2.x in devDependencies (bundled at build time like zod; no runtime deps for users).

- [ ] **Step 2: Write the failing loader test** — `tests/engine/loadModule.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadModule } from "../../src/engine/loadModule.js";
import { LoadError } from "../../src/engine/loadSections.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-mod-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadModule", () => {
  it("returns null for a missing file", async () => {
    await expect(loadModule(join(dir, "nope.link.ts"))).resolves.toBeNull();
  });

  it("loads a typed TS module's default export", async () => {
    await writeFile(
      join(dir, "header.link.ts"),
      `import type { HeaderFile } from "link-free";
export default {
  blocks: [{ component: "profile", image: "./a.png", name: "Jane" }],
} satisfies HeaderFile;
`,
    );
    const data = await loadModule(join(dir, "header.link.ts"));
    expect(data).toEqual({
      blocks: [{ component: "profile", image: "./a.png", name: "Jane" }],
    });
  });

  it("throws LoadError on a syntax error, naming the file", async () => {
    await writeFile(join(dir, "bad.link.ts"), `export default { blocks: [`);
    await expect(loadModule(join(dir, "bad.link.ts"))).rejects.toThrow(LoadError);
    await expect(loadModule(join(dir, "bad.link.ts"))).rejects.toThrow(/failed to load/);
  });

  it("throws when there is no default export", async () => {
    await writeFile(join(dir, "nodefault.link.ts"), `export const x = 1;`);
    await expect(loadModule(join(dir, "nodefault.link.ts"))).rejects.toThrow(
      /expected a default export/,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/engine/loadModule.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 4: Implement `src/engine/loadModule.ts`**

```ts
import { access } from "node:fs/promises";
import { createJiti } from "jiti";
import { LoadError } from "./loadSections.js";

const jiti = createJiti(import.meta.url);

/**
 * Loads a `[section].link.ts` config module's default export via jiti.
 * Returns null when the file does not exist. Load errors and missing
 * default exports are LoadErrors naming the file.
 */
export async function loadModule(path: string): Promise<unknown | null> {
  try {
    await access(path);
  } catch {
    return null;
  }
  let mod: unknown;
  try {
    mod = await jiti.import(path);
  } catch (err) {
    throw new LoadError(`${path}: failed to load — ${(err as Error).message}`);
  }
  // jiti's interop exposes a .default getter returning the namespace even when
  // no default export exists, so undefined-checking does not work; hasOwn does.
  if (mod === null || typeof mod !== "object" || !Object.hasOwn(mod, "default")) {
    throw new LoadError(`${path}: expected a default export`);
  }
  return (mod as Record<string, unknown>).default;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/engine/loadModule.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Rewrite `tests/engine/loadSections.test.ts` for .link.ts fixtures**

Keep the same structure (tmpdir per test, `write` helper) but the helper now writes raw text, and all fixtures become TS modules. Full new version:

```ts
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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

const write = (name: string, content: string) => writeFile(join(dir, name), content, "utf8");

describe("loadSections", () => {
  it("returns null sections when files are absent", async () => {
    await write("body.link.ts", `export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }`);
    const sections = await loadSections(dir);
    expect(sections.header).toBeNull();
    expect(sections.footer).toBeNull();
    expect(sections.site).toEqual({});
    expect(sections.theme).toEqual({ theme: "light" });
    expect(sections.body).toHaveLength(1);
  });

  it("throws when all five files are missing", async () => {
    await expect(loadSections(dir)).rejects.toThrow(/no \*\.link\.ts config files found/);
  });

  it("throws the migration guard when only JSON configs are present", async () => {
    await write("link.body.json", `{ "blocks": [] }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /JSON configs are no longer supported as of v0\.2\.0/,
    );
  });

  it("throws on a module load error, naming the file", async () => {
    await write("body.link.ts", `export default { blocks: [`);
    await expect(loadSections(dir)).rejects.toThrow(/body\.link\.ts.*failed to load/);
  });

  it("throws on unknown component, listing valid names", async () => {
    await write("body.link.ts", `export default { blocks: [{ component: "carousel" }] }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /blocks\[0\]: unknown component "carousel".*profile/,
    );
  });

  it("throws with zod issue path on schema failure", async () => {
    await write("body.link.ts", `export default { blocks: [{ component: "link", title: "Blog", url: "nope" }] }`);
    await expect(loadSections(dir)).rejects.toThrow(/blocks\[0\]\.url/);
  });

  it("validates blocks through the registry and strips unknown keys", async () => {
    await write("footer.link.ts", `export default { blocks: [{ component: "text", text: "hi", future: 1 }] }`);
    const sections = await loadSections(dir);
    expect(sections.footer).toEqual([{ component: "text", text: "hi" }]);
  });

  it("validates site.link.ts when present", async () => {
    await write("site.link.ts", `export default { title: "Jane", canonicalUrl: "bad" }`);
    await expect(loadSections(dir)).rejects.toThrow(LoadError);
  });

  it("rejects a component that is not allowed in that section", async () => {
    await write("header.link.ts", `export default { blocks: [{ component: "link", title: "Blog", url: "https://b.dev" }] }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /header\.link\.ts → blocks\[0\]: component "link" not allowed here \(valid: profile, socials\)/,
    );
  });

  it("loads and validates config.link.ts", async () => {
    await write("config.link.ts", `export default { theme: "dark", tokens: { accent: "#fff" } }`);
    const sections = await loadSections(dir);
    expect(sections.theme.theme).toBe("dark");
    expect(sections.theme.tokens?.accent).toBe("#fff");
  });

  it("rejects an unknown preset, listing valid themes", async () => {
    await write("config.link.ts", `export default { theme: "dracula" }`);
    await expect(loadSections(dir)).rejects.toThrow(
      /config\.link\.ts → theme: unknown theme "dracula" \(valid: light, dark, minimal\)/,
    );
  });

  it("rejects a bad token with a zod issue path", async () => {
    await write("config.link.ts", `export default { tokens: { radius: "huge" } }`);
    await expect(loadSections(dir)).rejects.toThrow(/config\.link\.ts → tokens\.radius/);
  });

  it("accepts a directory containing only config.link.ts", async () => {
    await write("config.link.ts", `export default { theme: "dark" }`);
    const sections = await loadSections(dir);
    expect(sections.theme.theme).toBe("dark");
    expect(sections.header).toBeNull();
  });
});
```

Note: the previous tests for malformed JSON, ENOENT-vs-EISDIR, and wrapper-shape are dropped (no JSON parsing anymore; module loading has its own tests in loadModule.test.ts).

- [ ] **Step 7: Update `src/engine/loadSections.ts`**

Full new version:

```ts
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { sectionFileSchema, siteFileSchema, themeConfigSchema, type SiteFile, type ThemeConfig } from "../schema/files.js";
import { COMPONENT_NAMES, registry, type ValidatedBlock } from "../components/registry.js";
import { loadModule } from "./loadModule.js";

export class LoadError extends Error {}

const SECTION_NAMES = ["header", "body", "footer"] as const;
type SectionName = (typeof SECTION_NAMES)[number];

/** Which components each section file accepts (spec §4.7). */
export const SECTION_COMPONENTS: Record<SectionName, string[]> = {
  header: ["profile", "socials"],
  body: ["link"],
  footer: ["text"],
};

export interface Sections {
  site: SiteFile;
  theme: ThemeConfig;
  header: ValidatedBlock[] | null;
  body: ValidatedBlock[] | null;
  footer: ValidatedBlock[] | null;
}

function validateBlocks(raw: unknown, section: SectionName): ValidatedBlock[] {
  const fileName = `${section}.link.ts`;
  const wrapper = sectionFileSchema.safeParse(raw);
  if (!wrapper.success) {
    throw new LoadError(`${fileName}: expected an object with a "blocks" array`);
  }
  return wrapper.data.blocks.map((block, i) => {
    const component = block.component;
    if (typeof component !== "string" || !Object.hasOwn(registry, component)) {
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

function formatIssues(fileName: string, issues: { path: (string | number)[]; message: string }[]): LoadError {
  return new LoadError(
    issues.map((issue) => `${fileName} → ${issue.path.join(".")}: ${issue.message}`).join("\n"),
  );
}

export async function loadSections(dir: string): Promise<Sections> {
  const siteRaw = await loadModule(join(dir, "site.link.ts"));
  const themeRaw = await loadModule(join(dir, "config.link.ts"));

  const sections: Record<SectionName, ValidatedBlock[] | null> = {
    header: null,
    body: null,
    footer: null,
  };
  for (const name of SECTION_NAMES) {
    const raw = await loadModule(join(dir, `${name}.link.ts`));
    if (raw != null) {
      sections[name] = validateBlocks(raw, name);
    }
  }

  const nothingFound =
    siteRaw == null && themeRaw == null && SECTION_NAMES.every((n) => sections[n] == null);

  if (nothingFound) {
    // Migration guard: stale JSON configs get a clear message instead of silence.
    const entries = await readdir(dir).catch(() => [] as string[]);
    if (entries.some((e) => /^link\.(site|header|body|footer|free\.config)\.json$/.test(e))) {
      throw new LoadError(
        `JSON configs are no longer supported as of v0.2.0 — convert them to <section>.link.ts modules`,
      );
    }
    throw new LoadError(`no *.link.ts config files found in ${dir}`);
  }

  let site: SiteFile = {};
  if (siteRaw != null) {
    const parsed = siteFileSchema.safeParse(siteRaw);
    if (!parsed.success) throw formatIssues("site.link.ts", parsed.error.issues);
    site = parsed.data;
  }

  let theme: ThemeConfig = themeConfigSchema.parse({});
  if (themeRaw != null) {
    const parsed = themeConfigSchema.safeParse(themeRaw);
    if (!parsed.success) throw formatIssues("config.link.ts", parsed.error.issues);
    theme = parsed.data;
  }

  return { site, theme, ...sections };
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm test && pnpm typecheck`
Expected: full suite green — loadSections suite now 13 tests, loadModule 4; total 117 (113 − 3 dropped + 4 loadModule + 3 net loadSections changes; report actual if different), typecheck clean. Note: build.test.ts and init tests still use JSON fixtures and WILL fail at this point — that is expected; they are updated in Tasks 3-4. Run `pnpm vitest run tests/engine/` to confirm the engine suites are green and report the overall red suites as expected-pending.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/engine/loadModule.ts src/engine/loadSections.ts tests/engine/loadModule.test.ts tests/engine/loadSections.test.ts
git commit -m "feat: jiti loader + .link.ts config discovery (drop JSON loading)"
```

---

### Task 2: Type exports + packaging (0.2.0)

**Files:**
- Create: `src/index.ts`
- Modify: `src/schema/files.ts` (export inferred file types)
- Modify: `tsup.config.ts` (dual entry + dts)
- Modify: `package.json` (exports field, version, devDeps)

- [ ] **Step 1: Export the inferred types** — append to `src/schema/files.ts`:

```ts
export type HeaderFile = z.infer<typeof headerFileSchema>;
export type BodyFile = z.infer<typeof bodyFileSchema>;
export type FooterFile = z.infer<typeof footerFileSchema>;
```

(`SiteFile` and `ThemeConfig` are already exported.)

- [ ] **Step 2: Create `src/index.ts`**

```ts
export type {
  BodyFile,
  FooterFile,
  HeaderFile,
  SiteFile,
  ThemeConfig,
} from "./schema/files.js";
```

- [ ] **Step 3: Update `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  noExternal: ["zod", "jiti"],
  dts: { entry: ["src/index.ts"] },
});
```

Note: `banner` applies to ALL entries (index.js also gets a shebang; harmless). If `dts: { entry: [...] }` errors on this tsup version, fall back to `dts: true` and report the substitution.

- [ ] **Step 4: Update `package.json`**

- `"version": "0.2.0"`
- Add after `"bin"`:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "types": "./dist/index.d.ts",
  "main": "./dist/index.js",
```

- Remove devDeps `zod-to-json-schema` and `vite-node`, and the `"schemas"` script (used in Task 4's cleanup; do it here to keep the manifest coherent).

- [ ] **Step 5: Verify the build**

Run: `pnpm build && ls dist/`
Expected: `dist/cli.js` and `dist/index.js` + `dist/index.d.ts`. Then:

Run: `node -e "import('node:fs').then(fs => { const d = fs.readFileSync('dist/index.d.ts','utf8'); if (!d.includes('HeaderFile') || !d.includes('ThemeConfig')) process.exit(1); console.log('types ok'); })"`
Expected: `types ok`.

Also verify the CLI still works: `node dist/cli.js --help` prints usage.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/schema/files.ts tsup.config.ts package.json pnpm-lock.yaml
git commit -m "feat: ship config types from the package (v0.2.0)"
```

---

### Task 3: `init` rewrite (framework-style scaffolding)

**Files:**
- Modify: `src/engine/init.ts` (full rewrite)
- Modify: `src/cli.ts` (output for skipped files + install hint)
- Test: rewrite `tests/engine/init.test.ts`

- [ ] **Step 1: Rewrite `tests/engine/init.test.ts`**

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initProject } from "../../src/engine/init.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-init-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const CONFIG_FILES = [
  "site.link.ts",
  "header.link.ts",
  "body.link.ts",
  "footer.link.ts",
  "config.link.ts",
];

describe("initProject", () => {
  it("scaffolds package.json, tsconfig, and five typed config files", async () => {
    const result = await initProject(dir, {});
    expect(result.created.sort()).toEqual(
      [...CONFIG_FILES, "package.json", "tsconfig.json"].sort(),
    );

    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    expect(pkg.private).toBe(true);
    expect(pkg.devDependencies["link-free"]).toBe("^0.2.0");
    expect(pkg.scripts.build).toBe("link-free build");

    const header = await readFile(join(dir, "header.link.ts"), "utf8");
    expect(header).toContain('import type { HeaderFile } from "link-free";');
    expect(header).toContain("satisfies HeaderFile");

    const config = await readFile(join(dir, "config.link.ts"), "utf8");
    expect(config).toContain("satisfies ThemeConfig");
  });

  it("uses a sanitized directory name for package.json", async () => {
    const nested = join(dir, "My Cool Site");
    await rm(nested, { recursive: true, force: true });
    const { mkdir } = await import("node:fs/promises");
    await mkdir(nested);
    const result = await initProject(nested, {});
    const pkg = JSON.parse(await readFile(join(nested, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-cool-site");
    expect(result.created).toContain("package.json");
  });

  it("never overwrites an existing package.json or tsconfig.json", async () => {
    await writeFile(join(dir, "package.json"), `{ "name": "keep-me" }`);
    await writeFile(join(dir, "tsconfig.json"), `{ "compilerOptions": {} }`);
    const result = await initProject(dir, {});
    expect(result.skipped.sort()).toEqual(["package.json", "tsconfig.json"]);
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    expect(pkg.name).toBe("keep-me");
    expect(result.created.sort()).toEqual([...CONFIG_FILES].sort());
  });

  it("aborts on existing config files, writing nothing, unless forced", async () => {
    await writeFile(join(dir, "header.link.ts"), `export default {}`);
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: header\.link\.ts \(use --force to overwrite\)/,
    );
    await expect(readFile(join(dir, "body.link.ts"), "utf8")).rejects.toThrow();

    const result = await initProject(dir, { force: true });
    expect(result.created).toContain("header.link.ts");
  });

  it("lists multiple existing config files in the error", async () => {
    await writeFile(join(dir, "site.link.ts"), `export default {}`);
    await writeFile(join(dir, "body.link.ts"), `export default {}`);
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: site\.link\.ts, body\.link\.ts/,
    );
  });
});
```

(The inline `mkdir` import in test 2 may be hoisted to the top-level fs/promises import if you prefer.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/engine/init.test.ts`
Expected: FAIL — signature/behavior changed

- [ ] **Step 3: Rewrite `src/engine/init.ts`**

```ts
import { access, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { LoadError } from "./loadSections.js";

const CONFIG_FILES: Record<string, string> = {
  "site.link.ts": `import type { SiteFile } from "link-free";

export default {
  title: "Your Name — Links",
  description: "All my links in one place.",
} satisfies SiteFile;
`,
  "header.link.ts": `import type { HeaderFile } from "link-free";

export default {
  blocks: [
    {
      component: "profile",
      image: "https://example.com/avatar.png",
      name: "Your Name",
      bio: "Something about you.",
    },
    {
      component: "socials",
      links: [{ icon: "website", url: "https://example.com", label: "Website" }],
    },
  ],
} satisfies HeaderFile;
`,
  "body.link.ts": `import type { BodyFile } from "link-free";

export default {
  blocks: [{ component: "link", title: "My website", url: "https://example.com" }],
} satisfies BodyFile;
`,
  "footer.link.ts": `import type { FooterFile } from "link-free";

export default {
  blocks: [{ component: "text", text: "Made with link-free" }],
} satisfies FooterFile;
`,
  "config.link.ts": `import type { ThemeConfig } from "link-free";

export default {
  theme: "light",
} satisfies ThemeConfig;
`,
};

const TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "Bundler",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  },
};

function sanitizeName(dir: string): string {
  const base = basename(dir).toLowerCase();
  const cleaned = base.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "my-links";
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface InitResult {
  created: string[];
  skipped: string[];
}

/**
 * Framework-style scaffolding: package.json + tsconfig + five typed
 * [section].link.ts config files. Config collisions abort all-or-nothing
 * unless force is set; package.json/tsconfig.json are never overwritten.
 */
export async function initProject(dir: string, options: { force?: boolean }): Promise<InitResult> {
  const configNames = Object.keys(CONFIG_FILES);

  const colliding: string[] = [];
  for (const name of configNames) {
    if (await exists(join(dir, name))) colliding.push(name);
  }
  if (colliding.length > 0 && !options.force) {
    throw new LoadError(
      `config files already exist: ${colliding.join(", ")} (use --force to overwrite)`,
    );
  }

  const created: string[] = [];
  const skipped: string[] = [];

  const pkgPath = join(dir, "package.json");
  if (await exists(pkgPath)) {
    skipped.push("package.json");
  } else {
    const pkg = {
      name: sanitizeName(dir),
      private: true,
      type: "module",
      scripts: { build: "link-free build" },
      devDependencies: { "link-free": "^0.2.0" },
    };
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    created.push("package.json");
  }

  const tsconfigPath = join(dir, "tsconfig.json");
  if (await exists(tsconfigPath)) {
    skipped.push("tsconfig.json");
  } else {
    await writeFile(tsconfigPath, JSON.stringify(TSCONFIG, null, 2) + "\n", "utf8");
    created.push("tsconfig.json");
  }

  for (const name of configNames) {
    await writeFile(join(dir, name), CONFIG_FILES[name], "utf8");
    created.push(name);
  }

  return { created, skipped };
}
```

- [ ] **Step 4: Update `src/cli.ts` init branch output**

Replace the init success output with:

```ts
      const result = await initProject(resolve(values.dir), { force: values.force });
      console.log(`created ${result.created.length} files:`);
      for (const name of result.created) console.log(`  ${name}`);
      for (const name of result.skipped) console.log(`  ${name} (kept existing)`);
      console.log("\nnext: pnpm install (or npm/yarn install), then pnpm build");
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/engine/init.test.ts && pnpm typecheck`
Expected: PASS (5 tests), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/init.ts src/cli.ts tests/engine/init.test.ts
git commit -m "feat: init scaffolds package.json, tsconfig, typed configs"
```

---

### Task 4: Removals, example, README, final verification

**Files:**
- Delete: `schemas/`, `scripts/generate-schemas.ts`, `tests/schema/drift.test.ts`
- Modify: `example/*` (JSON → .link.ts), `README.md`, `tests/build.test.ts` (JSON fixtures → TS)

- [ ] **Step 1: Delete the JSON Schema machinery**

Run: `git rm -r schemas/ scripts/generate-schemas.ts tests/schema/drift.test.ts`
(`zod-to-json-schema`, `vite-node`, and the `schemas` script were already removed from package.json in Task 2.)

- [ ] **Step 2: Update `tests/build.test.ts` fixtures**

The `write` helper currently does `JSON.stringify(data)`. Change it to write raw strings, and convert every fixture: e.g.

```ts
const write = (name: string, content: string) => writeFile(join(dir, name), content, "utf8");

// example fixture:
await write("site.link.ts", `export default { title: "Jane — Links", description: "all my links" }`);
await write("header.link.ts", `export default { blocks: [
  { component: "profile", image: "https://example.com/a.png", name: "Jane" },
  { component: "socials", links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }] },
] }`);
```

Convert ALL fixtures in the file (file names and syntax), keeping every test's intent and assertions identical. The asset tests still write a real `avatar.png` alongside.

- [ ] **Step 3: Convert the example**

Delete `example/link.*.json` and create:

`example/site.link.ts`:
```ts
import type { SiteFile } from "link-free";

export default {
  title: "Jane Doe — Links",
  description: "All of Jane Doe's links in one place.",
  lang: "en",
  canonicalUrl: "https://links.janedoe.dev",
  ogImage: "https://links.janedoe.dev/og.png",
} satisfies SiteFile;
```

`example/header.link.ts`:
```ts
import type { HeaderFile } from "link-free";

export default {
  blocks: [
    {
      component: "profile",
      image: "./avatar.png",
      name: "Jane Doe",
      bio: "Engineer, writer, coffee enthusiast.",
    },
    {
      component: "socials",
      links: [
        { icon: "github", url: "https://github.com/janedoe", label: "GitHub" },
        { icon: "x", url: "https://x.com/janedoe", label: "X" },
        { icon: "website", url: "https://janedoe.dev", label: "Website" },
      ],
    },
  ],
} satisfies HeaderFile;
```

`example/body.link.ts`:
```ts
import type { BodyFile } from "link-free";

export default {
  blocks: [
    { component: "link", title: "My blog", url: "https://blog.janedoe.dev", description: "Long-form writing" },
    { component: "link", title: "Talks", url: "https://janedoe.dev/talks" },
    { component: "link", title: "Contact", url: "mailto:jane@janedoe.dev" },
  ],
} satisfies BodyFile;
```

`example/footer.link.ts`:
```ts
import type { FooterFile } from "link-free";

export default {
  blocks: [{ component: "text", text: "© 2026 Jane Doe — built with link-free" }],
} satisfies FooterFile;
```

`example/config.link.ts`:
```ts
import type { ThemeConfig } from "link-free";

export default {
  theme: "dark",
  tokens: {
    accent: "#f472b6",
    radius: "lg",
    density: "comfortable",
  },
} satisfies ThemeConfig;
```

- [ ] **Step 4: Rewrite README config docs**

Replace the "Usage", config table, theming, local assets, and editor autocomplete sections with TS-config equivalents:

```markdown
# link-free

Tiny, open link-in-bio generator. Write a few TypeScript config files, run one
command, get a single static, semantic, SEO-first HTML page with zero
JavaScript.

## Usage

```sh
npx link-free init             # scaffold a project (package.json + typed configs)
npm install                    # or pnpm/yarn — gives your editor the config types
npx link-free build            # generate dist/index.html
```

`init` writes `package.json`, `tsconfig.json`, and five starter config files.
It refuses to overwrite existing config files unless you pass `--force`.

## Config files

All optional; a missing file means that section is omitted. Each file has a
typed default export checked by your editor against the package's types:

| File | Type | Purpose |
| --- | --- | --- |
| `site.link.ts` | `SiteFile` | Page-level SEO: title, description, lang, canonicalUrl, ogImage |
| `header.link.ts` | `HeaderFile` | `profile` (image, name, bio) + `socials` (icon links) blocks |
| `body.link.ts` | `BodyFile` | `link` blocks (title, url, description) |
| `footer.link.ts` | `FooterFile` | `text` blocks |
| `config.link.ts` | `ThemeConfig` | Theme preset + token overrides |

```ts
// header.link.ts
import type { HeaderFile } from "link-free";

export default {
  blocks: [
    { component: "profile", image: "./avatar.png", name: "Your Name" },
  ],
} satisfies HeaderFile;
```

## Theming

`config.link.ts` picks a preset (`light` default, `dark`, `minimal`) and
overrides tokens: `accent`, `background`, `backgroundImage` (URL or local
path), `surface`, `text` (any CSS color), `font` (`system` | `serif` |
`mono`), `radius` / `avatarRadius` (`sm` | `md` | `lg` | `full`), `density`
(`compact` | `comfortable`). CSS is precompiled and inlined with zero
JavaScript — output is a single HTML page, plus an `assets/` folder when you
reference local images.

## Local assets

Image fields (`profile.image`, `ogImage`, `backgroundImage`) accept either an
absolute URL or a local path relative to your config directory. Local files
are copied into an `assets/` folder inside the output directory and
references are rewritten. A missing file or a path outside the config
directory fails the build with a clear error. A local `ogImage` is rewritten
to an absolute URL when `canonicalUrl` is set; without it the `og:image`
stays relative, which social crawlers cannot fetch.

See `example/` for a complete config. Design specs: `docs/superpowers/specs/`.
```

- [ ] **Step 5: Full clean verification**

Run: `rm -rf node_modules dist example/dist && pnpm install && pnpm test && pnpm typecheck && pnpm build`
Expected: install clean, all tests PASS, no type errors, `dist/cli.js` + `dist/index.js` + `dist/index.d.ts` emitted.

- [ ] **Step 6: Smoke tests**

```bash
node dist/cli.js build --dir example --out example/dist   # builds from .link.ts
node dist/cli.js init --dir /tmp/lf-ts-smoke && node dist/cli.js build --dir /tmp/lf-ts-smoke
mkdir -p /tmp/lf-json-smoke && echo '{"blocks":[]}' > /tmp/lf-json-smoke/link.body.json
node dist/cli.js build --dir /tmp/lf-json-smoke; echo "exit=$?"   # migration guard, exit 1
rm -rf /tmp/lf-ts-smoke /tmp/lf-json-smoke
```

Expected: example builds with assets/; init+build cycle works; JSON dir hits the migration guard with exit 1.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: TS config migration complete (example, README, removals)"
```

---

## Notes for reviewers

- jiti transpiles type-only syntax away, so configs load without the package installed; editor type-checking is what requires `npm install` in the user's project.
- `import type` in starter/example files intentionally references the published package name, not a relative path.
- The JSON-migration guard checks file names only when NO .link.ts files are found, so a stray old JSON next to TS files is simply ignored (deliberate: mixed state during migration).
