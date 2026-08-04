# link-free `init` Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `link-free init [--dir] [--force]` scaffolding the five config files with placeholder content and `$schema` URLs.

**Architecture:** `initProject(dir, { force })` in new `src/engine/init.ts` writes five constant config objects as pretty JSON (all-or-nothing; collision aborts with LoadError listing existing files). The CLI gains an `init` positional branch with a `--force` flag.

**Tech Stack:** TypeScript, vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-05-link-free-init-design.md`

---

### Task 1: `initProject`

**Files:**
- Create: `src/engine/init.ts`
- Test: `tests/engine/init.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/engine/init.test.ts`:

```ts
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initProject } from "../../src/engine/init.js";
import { headerFileSchema, siteFileSchema, themeConfigSchema } from "../../src/schema/files.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lf-init-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const FILES = [
  "link.site.json",
  "link.header.json",
  "link.body.json",
  "link.footer.json",
  "link.free.config.json",
];

describe("initProject", () => {
  it("creates all five config files and returns their names", async () => {
    const created = await initProject(dir, {});
    expect(created.sort()).toEqual([...FILES].sort());
    for (const name of FILES) {
      const raw = await readFile(join(dir, name), "utf8");
      const parsed = JSON.parse(raw);
      expect(Object.keys(parsed)[0], `${name} starts with $schema`).toBe("$schema");
    }
  });

  it("starter content passes the real schemas", async () => {
    await initProject(dir, {});
    siteFileSchema.parse(JSON.parse(await readFile(join(dir, "link.site.json"), "utf8")));
    headerFileSchema.parse(JSON.parse(await readFile(join(dir, "link.header.json"), "utf8")));
    themeConfigSchema.parse(JSON.parse(await readFile(join(dir, "link.free.config.json"), "utf8")));
  });

  it("aborts on existing files, writing nothing, unless forced", async () => {
    await writeFile(join(dir, "link.site.json"), "{}");
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: link\.site\.json \(use --force to overwrite\)/,
    );
    // nothing new written
    await expect(readFile(join(dir, "link.header.json"), "utf8")).rejects.toThrow();

    const created = await initProject(dir, { force: true });
    expect(created).toHaveLength(5);
    const site = JSON.parse(await readFile(join(dir, "link.site.json"), "utf8"));
    expect(site.title).toBe("Your Name — Links");
  });

  it("lists multiple existing files in the error", async () => {
    await writeFile(join(dir, "link.site.json"), "{}");
    await writeFile(join(dir, "link.body.json"), "{}");
    await expect(initProject(dir, {})).rejects.toThrow(
      /config files already exist: link\.site\.json, link\.body\.json/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/engine/init.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/engine/init.ts`**

```ts
import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LoadError } from "./loadSections.js";

const SCHEMA_BASE = "https://raw.githubusercontent.com/brasillero/link-free/master/schemas";

const STARTER_FILES: Record<string, unknown> = {
  "link.site.json": {
    $schema: `${SCHEMA_BASE}/link.site.schema.json`,
    title: "Your Name — Links",
    description: "All my links in one place.",
  },
  "link.header.json": {
    $schema: `${SCHEMA_BASE}/link.header.schema.json`,
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
  },
  "link.body.json": {
    $schema: `${SCHEMA_BASE}/link.body.schema.json`,
    blocks: [{ component: "link", title: "My website", url: "https://example.com" }],
  },
  "link.footer.json": {
    $schema: `${SCHEMA_BASE}/link.footer.schema.json`,
    blocks: [{ component: "text", text: "Made with link-free" }],
  },
  "link.free.config.json": {
    $schema: `${SCHEMA_BASE}/link.free.config.schema.json`,
    theme: "light",
  },
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scaffolds the five config files in `dir`. All-or-nothing: if any target
 * exists and `force` is not set, throws before writing anything.
 * Returns the created file names.
 */
export async function initProject(dir: string, options: { force?: boolean }): Promise<string[]> {
  const names = Object.keys(STARTER_FILES);
  const existing: string[] = [];
  for (const name of names) {
    if (await exists(join(dir, name))) existing.push(name);
  }
  if (existing.length > 0 && !options.force) {
    throw new LoadError(
      `config files already exist: ${existing.join(", ")} (use --force to overwrite)`,
    );
  }
  for (const name of names) {
    await writeFile(join(dir, name), JSON.stringify(STARTER_FILES[name], null, 2) + "\n", "utf8");
  }
  return names;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/engine/init.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/engine/init.ts tests/engine/init.test.ts
git commit -m "feat: initProject scaffolding engine"
```

---

### Task 2: CLI `init` command + verification

**Files:**
- Modify: `src/cli.ts`
- Modify: `README.md`
- Test: `tests/engine/init.test.ts` (no changes; CLI smoke is manual)

- [ ] **Step 1: Update `src/cli.ts`**

Read the current file first (it has been through review cycles). Make these minimal edits:

1. Add import: `import { initProject } from "./engine/init.js";`
2. USAGE becomes:

```ts
const USAGE = "Usage: link-free <command>\n  link-free build [--dir <path>] [--out <path>]\n  link-free init [--dir <path>] [--force]";
```

3. Add `force` to the parseArgs options:

```ts
        force: { type: "boolean", default: false },
```

(and `force: boolean` in the values type annotation)

4. Update the command guard so both `build` and `init` are accepted. Current shape is roughly `if (command !== "build" || positionals.length > 1)`; change to:

```ts
  if ((command !== "build" && command !== "init") || positionals.length > 1) {
    console.error(USAGE);
    process.exit(1);
  }
```

5. Add the init branch before the build call:

```ts
  if (command === "init") {
    try {
      const created = await initProject(resolve(values.dir), { force: values.force });
      console.log(`created ${created.length} config files in ${resolve(values.dir)}:`);
      for (const name of created) console.log(`  ${name}`);
      console.log("\nedit them, then run: link-free build");
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exit(1);
    }
    return;
  }
```

- [ ] **Step 2: Verify typecheck and suite**

Run: `pnpm test && pnpm typecheck`
Expected: full suite PASS (113 tests — 109 + 4 init), typecheck clean.

- [ ] **Step 3: CLI smoke test**

```bash
pnpm build
mkdir -p /tmp/lf-init-smoke || true
node dist/cli.js init --dir /tmp/lf-init-smoke
node dist/cli.js init --dir /tmp/lf-init-smoke; echo "exit=$?"
node dist/cli.js build --dir /tmp/lf-init-smoke
ls /tmp/lf-init-smoke/dist/index.html
rm -rf /tmp/lf-init-smoke dist
```

Expected: first init creates 5 files; second init exits 1 with the collision error; build succeeds from the scaffolded content and produces index.html. (If /tmp is awkward on Windows, use a repo-local temp dir and delete it.)

- [ ] **Step 4: Update README Usage section**

Replace the usage block in `README.md` with:

```markdown
## Usage

```sh
npx link-free init             # scaffold the config files in your project
npx link-free build            # generate dist/index.html
npx link-free build --dir . --out dist
```

`init` writes starter versions of every config file (with editor `$schema`
URLs) and refuses to overwrite existing ones unless you pass `--force`.
```

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts README.md
git commit -m "feat: link-free init command"
```
