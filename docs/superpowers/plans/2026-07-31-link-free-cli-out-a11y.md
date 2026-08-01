# link-free CLI `--out` Fix + focus-visible Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `--out` default to `<dir>/dist` (fixing the CWD surprise), and add `focus-visible:` parity to hover styles on link cards and social icons.

**Architecture:** The path default is extracted into a tiny pure helper `resolveOutDir(dir, out?)` in `src/outPath.ts` so it is unit-testable without importing the side-effecting CLI entry. The a11y change is two class-string additions in existing renderers; the `pnpm css` precompile picks the new utilities up automatically.

**Tech Stack:** TypeScript, vitest, node:path.

**Spec:** `docs/superpowers/specs/2026-07-31-link-free-cli-out-a11y-design.md`

---

### Task 1: `--out` defaults to `<dir>/dist`

**Files:**
- Create: `src/outPath.ts`
- Modify: `src/cli.ts`
- Test: `tests/outPath.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/outPath.test.ts`:

```ts
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveOutDir } from "../src/outPath.js";

describe("resolveOutDir", () => {
  it("defaults to <dir>/dist when out is not passed", () => {
    expect(resolveOutDir("/site", undefined)).toBe(resolve("/site", "dist"));
  });

  it("resolves an explicit out against the cwd", () => {
    expect(resolveOutDir("/site", "public")).toBe(resolve("public"));
  });

  it("keeps bare-build behavior (dir defaults to '.')", () => {
    expect(resolveOutDir(".", undefined)).toBe(resolve("dist"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/outPath.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write the helper** — `src/outPath.ts`:

```ts
import { resolve } from "node:path";

/**
 * Where the built index.html goes.
 * No explicit --out → <dir>/dist. Explicit --out → resolved against the cwd.
 */
export function resolveOutDir(dir: string, out: string | undefined): string {
  return out === undefined ? resolve(dir, "dist") : resolve(out);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/outPath.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire it into `src/cli.ts`**

Current relevant code (from the theming-era cli.ts):

```ts
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "./engine/build.js";

const USAGE = "Usage: link-free build [--dir <path>] [--out <path>]";

async function main(): Promise<void> {
  let values: { dir: string; out: string; help: boolean };
  let positionals: string[];
  try {
    const parsed = parseArgs({
      allowPositionals: true,
      options: {
        dir: { type: "string", default: "." },
        out: { type: "string", default: "dist" },
        help: { type: "boolean", short: "h", default: false },
      },
    });
    values = parsed.values as typeof values;
    positionals = parsed.positionals;
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    console.error(USAGE);
    process.exit(1);
  }
  // ... command checks ...
  try {
    const outPath = await build(resolve(values.dir), resolve(values.out));
    console.log(`built ${outPath}`);
  // ...
```

Change to:

1. Add import: `import { resolveOutDir } from "./outPath.js";`
2. USAGE becomes:

```ts
const USAGE = "Usage: link-free build [--dir <path>] [--out <path>]\n  (default output: <dir>/dist)";
```

3. In the parseArgs options, remove the default from `out`:

```ts
        out: { type: "string" },
```

4. Update the values type annotation to `let values: { dir: string; out: string | undefined; help: boolean };`
5. Replace the build call:

```ts
    const dir = resolve(values.dir);
    const outPath = await build(dir, resolveOutDir(dir, values.out));
```

Note: if the exact current cli.ts differs slightly from the snippet above (it was edited in review cycles), make the equivalent minimal edits and keep everything else intact. Read the file first.

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm typecheck`
Expected: full suite PASS (77 tests — 74 + 3 new), typecheck clean.

- [ ] **Step 7: Smoke-test the real CLI**

```bash
pnpm build
mkdir -p /tmp/lf-outcheck && cp example/link.body.json /tmp/lf-outcheck/
node dist/cli.js build --dir /tmp/lf-outcheck && ls /tmp/lf-outcheck/dist/index.html
rm -rf /tmp/lf-outcheck dist
```

Expected: `built …/lf-outcheck/dist/index.html` and the file exists (previously it would have landed in `./dist`).

- [ ] **Step 8: Commit**

```bash
git add src/outPath.ts src/cli.ts tests/outPath.test.ts
git commit -m "fix: --out defaults to <dir>/dist instead of cwd"
```

---

### Task 2: focus-visible parity

**Files:**
- Modify: `src/components/link.ts`
- Modify: `src/components/socials.ts`
- Test: `tests/components/render.test.ts` (update exact class strings)

- [ ] **Step 1: Update the test expectations** — in `tests/components/render.test.ts`, replace the two exact renderLink class strings:

From:
```
class="lf-link block rounded-card bg-surface px-5 py-4 text-center font-medium text-ink shadow-sm transition hover:scale-[1.02] hover:text-accent"
```
To:
```
class="lf-link block rounded-card bg-surface px-5 py-4 text-center font-medium text-ink shadow-sm transition hover:scale-[1.02] hover:text-accent focus-visible:scale-[1.02] focus-visible:text-accent"
```

(Both `toBe` assertions in the "renders an li with anchor and optional description" test.)

In the renderSocials test, add:

```ts
    expect(html).toContain("focus-visible:text-accent");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/render.test.ts`
Expected: FAIL — old class strings

- [ ] **Step 3: Update the renderers**

`src/components/link.ts` — the anchor class string becomes:

```ts
  return `<li><a href="${escapeHtml(url)}" class="lf-link block rounded-card bg-surface px-5 py-4 text-center font-medium text-ink shadow-sm transition hover:scale-[1.02] hover:text-accent focus-visible:scale-[1.02] focus-visible:text-accent">${escapeHtml(title)}</a>${desc}</li>`;
```

`src/components/socials.ts` — the anchor class string becomes:

```ts
        `    <a href="${escapeHtml(l.url)}" rel="me" aria-label="${escapeHtml(l.label)}" class="text-ink transition hover:text-accent focus-visible:text-accent [&_svg]:block [&_svg]:h-6 [&_svg]:w-6">${ICONS[l.icon]}</a>`,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (77/77), and `pnpm css` regenerated styles include the focus-visible rules: `grep -o "focus-visible" src/theme/styles.css.ts | head -1` prints a match.

- [ ] **Step 5: Commit**

```bash
git add src/components/link.ts src/components/socials.ts tests/components/render.test.ts
git commit -m "feat: focus-visible parity for link cards and social icons"
```
