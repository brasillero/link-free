# link-free JSON Schema Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate JSON Schema documents for the five config files from the zod schemas, tracked in `schemas/`, with a drift-guard test and README docs.

**Architecture:** `zod-to-json-schema` (dev-only dep) converts `siteFileSchema`, `themeConfigSchema`, and three new per-section file schemas (discriminated unions of the allowed block types) into JSON Schema documents written by `scripts/generate-schemas.mjs`. A vitest guard regenerates into a temp dir and asserts byte-identity with the tracked files.

**Tech Stack:** TypeScript, zod v3, zod-to-json-schema (dev), vitest.

**Spec:** `docs/superpowers/specs/2026-08-04-link-free-json-schemas-design.md`

---

### Task 1: Per-section file schemas + generator + drift guard

**Files:**
- Modify: `src/schema/files.ts` (add headerFileSchema, bodyFileSchema, footerFileSchema)
- Modify: `package.json` (devDep + `schemas` script)
- Create: `scripts/generate-schemas.ts`
- Create: `schemas/link.site.schema.json` + 4 more (generated)
- Test: `tests/schema/fileSchemas.test.ts`, `tests/schema/drift.test.ts`

- [ ] **Step 1: Install the dev dependency**

Run: `pnpm add -D zod-to-json-schema`
Expected: v3.x lands in devDependencies. If it pulls zod v4 as a peer, stop and report BLOCKED (we are on zod v3.25).

- [ ] **Step 2: Write the failing consistency test** — `tests/schema/fileSchemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  bodyFileSchema,
  footerFileSchema,
  headerFileSchema,
} from "../../src/schema/files.js";

const profile = { component: "profile", image: "./a.png", name: "Jane" };
const socials = {
  component: "socials",
  links: [{ icon: "github", url: "https://github.com/jane", label: "GitHub" }],
};
const link = { component: "link", title: "Blog", url: "https://b.dev" };
const text = { component: "text", text: "hi" };

describe("per-section file schemas", () => {
  it("header accepts profile and socials, rejects link and text", () => {
    expect(headerFileSchema.parse({ blocks: [profile, socials] }).blocks).toHaveLength(2);
    expect(() => headerFileSchema.parse({ blocks: [link] })).toThrow();
    expect(() => headerFileSchema.parse({ blocks: [text] })).toThrow();
  });

  it("body accepts only link blocks", () => {
    expect(bodyFileSchema.parse({ blocks: [link] }).blocks).toHaveLength(1);
    expect(() => bodyFileSchema.parse({ blocks: [profile] })).toThrow();
  });

  it("footer accepts only text blocks", () => {
    expect(footerFileSchema.parse({ blocks: [text] }).blocks).toHaveLength(1);
    expect(() => footerFileSchema.parse({ blocks: [link] })).toThrow();
  });

  it("matches the SECTION_COMPONENTS rule from loadSections", () => {
    // Same accept/reject contract as the runtime, so generation can't drift.
    expect(headerFileSchema.safeParse({ blocks: [profile] }).success).toBe(true);
    expect(headerFileSchema.safeParse({ blocks: [link] }).success).toBe(false);
    expect(bodyFileSchema.safeParse({ blocks: [text] }).success).toBe(false);
    expect(footerFileSchema.safeParse({ blocks: [socials] }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/schema/fileSchemas.test.ts`
Expected: FAIL — exports don't exist

- [ ] **Step 4: Add the file schemas to `src/schema/files.ts`**

Add the import of block schemas:

```ts
import {
  linkBlockSchema,
  profileBlockSchema,
  socialsBlockSchema,
  textBlockSchema,
} from "./blocks.js";
```

Append:

```ts
/**
 * Per-section file schemas: richer than sectionFileSchema (which stays loose
 * at runtime so loadSections can emit curated per-block errors). Used for
 * JSON Schema generation and editor documentation.
 */
export const headerFileSchema = z.object({
  blocks: z.array(z.discriminatedUnion("component", [profileBlockSchema, socialsBlockSchema])),
});

export const bodyFileSchema = z.object({
  blocks: z.array(z.discriminatedUnion("component", [linkBlockSchema])),
});

export const footerFileSchema = z.object({
  blocks: z.array(z.discriminatedUnion("component", [textBlockSchema])),
});
```

Note: `z.discriminatedUnion` with a single option is valid zod v3. If tsc or zod complains, fall back to plain `linkBlockSchema` / `textBlockSchema` as the array element type (same validation semantics for a single member) and report the substitution.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/schema/fileSchemas.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write `scripts/generate-schemas.ts`**

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  bodyFileSchema,
  footerFileSchema,
  headerFileSchema,
  siteFileSchema,
  themeConfigSchema,
} from "../src/schema/files.js";

const BASE = "https://raw.githubusercontent.com/brasillero/link-free/master/schemas";

const targets = {
  "link.site.schema.json": siteFileSchema,
  "link.header.schema.json": headerFileSchema,
  "link.body.schema.json": bodyFileSchema,
  "link.footer.schema.json": footerFileSchema,
  "link.free.config.schema.json": themeConfigSchema,
};

const outDir =
  process.env.SCHEMAS_OUT ?? join(dirname(fileURLToPath(import.meta.url)), "..", "schemas");
mkdirSync(outDir, { recursive: true });

for (const [name, schema] of Object.entries(targets)) {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
  jsonSchema.$id = `${BASE}/${name}`;
  jsonSchema.$schema = "http://json-schema.org/draft-07/schema#";
  writeFileSync(join(outDir, name), JSON.stringify(jsonSchema, null, 2) + "\n");
  console.log(`wrote ${name}`);
}
```

Module loading: the script is TypeScript and imports the zod schemas with the project's `.js`-suffix convention, so plain `node` cannot run it. Run it through `vite-node`, which ships with vitest and resolves TS + `.js`→`.ts` imports exactly like the test suite does. `SCHEMAS_OUT` overrides the output dir (used by the drift-guard test).

- [ ] **Step 7: Add the package.json script and generate**

In `package.json` scripts, add:

```json
    "schemas": "vite-node scripts/generate-schemas.ts",
```

Run: `pnpm schemas`
Expected: five `wrote …` lines; five files in `schemas/`. Inspect `schemas/link.header.schema.json`: it should describe `profile` and `socials` block variants (oneOf/anyOf on `component`) and require `component`. If the `vite-node` bin is missing from `node_modules/.bin`, report DONE_WITH_CONCERNS and use `pnpm exec vite-node` explicitly in the script instead.

- [ ] **Step 8: Write the drift-guard test** — `tests/schema/drift.test.ts`:

```ts
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILES = [
  "link.site.schema.json",
  "link.header.schema.json",
  "link.body.schema.json",
  "link.footer.schema.json",
  "link.free.config.schema.json",
];

describe("generated JSON schemas", () => {
  it("are in sync with the zod schemas (run pnpm schemas to fix)", () => {
    const scratch = mkdtempSync(join(tmpdir(), "lf-schemas-"));
    try {
      execSync("pnpm schemas", {
        env: { ...process.env, SCHEMAS_OUT: scratch },
        stdio: "pipe",
      });
      for (const name of FILES) {
        const generated = readFileSync(join(scratch, name), "utf8");
        const tracked = readFileSync(join("schemas", name), "utf8");
        expect(generated, `${name} is stale — run \`pnpm schemas\``).toBe(tracked);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it("all five tracked files exist and carry a stable $id", () => {
    for (const name of FILES) {
      const schema = JSON.parse(readFileSync(join("schemas", name), "utf8"));
      expect(schema.$id).toBe(
        `https://raw.githubusercontent.com/brasillero/link-free/master/schemas/${name}`,
      );
    }
  });
});
```

The `SCHEMAS_OUT` env var (supported by the generator in Step 6) redirects output to the scratch dir so the test never mutates the tracked files.

- [ ] **Step 9: Run the full suite**

Run: `pnpm test && pnpm typecheck`
Expected: full suite PASS (109 tests — 103 + 4 fileSchemas + 2 drift), typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add src/schema/files.ts package.json pnpm-lock.yaml scripts/generate-schemas.ts schemas/ tests/schema/fileSchemas.test.ts tests/schema/drift.test.ts
git commit -m "feat: generated JSON schemas for editor autocomplete"
```

---

### Task 2: README + final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the editor autocomplete section** — append to `README.md`:

```markdown
## Editor autocomplete

JSON Schemas for every config file are published with the repo. Add a
`"$schema"` line at the top of a config file for autocomplete and inline
validation in VS Code and other editors:

```json
{
  "$schema": "https://raw.githubusercontent.com/brasillero/link-free/master/schemas/link.header.schema.json",
  "blocks": []
}
```

Available schemas: `link.site`, `link.header`, `link.body`, `link.footer`,
`link.free.config` (same base URL, ending in `.schema.json`).
```

- [ ] **Step 2: Full clean verification**

Run: `rm -rf node_modules dist example/dist && pnpm install && pnpm test && pnpm typecheck && pnpm build`
Expected: install clean, 109/109 tests PASS, no type errors, `dist/cli.js` emitted.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: editor autocomplete via JSON schemas"
```
