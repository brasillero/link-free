# link-free — CLI Output Path Fix + focus-visible Polish Spec

**Date:** 2026-07-31
**Status:** Approved in brainstorming session
**Builds on:** MVP spec + theming spec (same directory)

Two small, independent polish items in one batch.

## 1. `--out` default follows `--dir`

**Problem.** The CLI declares `--out` with a static default of `"dist"`, resolved against the current working directory. Running `link-free build --dir ./mysite` reads configs from `./mysite` but writes `index.html` to `./dist` under wherever the command was invoked. Users reasonably expect the output next to the inputs.

**Fix.** Remove the static default for `--out`:

- `--out` **not passed** → output directory is `<dir>/dist` (where `<dir>` is the resolved `--dir`, default `.`). Bare `link-free build` therefore still writes `./dist`, unchanged.
- `--out` **passed explicitly** → resolved against the CWD, exactly as today. An explicit path means what it says.

**Compatibility note.** The only behavior change is for invocations passing `--dir` without `--out`, which is the broken case being fixed. Bare builds and explicit `--out` builds are untouched.

**Implementation sketch.** In `src/cli.ts`, drop `default: "dist"` from the `out` option and compute the output as `values.out === undefined ? resolve(values.dir, "dist") : resolve(values.out)`. Usage text updated to `link-free build [--dir <path>] [--out <path>]` with a line noting the default is `<dir>/dist`.

**Tests.** CLI-level (spawn the built CLI or exercise the arg-to-path logic): bare build → `./dist`; `--dir <tmp>` → `<tmp>/dist/index.html`; `--dir <tmp> --out <tmp2>` → `<tmp2>/index.html`.

## 2. `focus-visible` parity for hover styles

**Problem.** Link cards and social icons give visual feedback (scale, accent color) only on pointer hover. Keyboard users tabbing through the page get no equivalent feedback beyond the browser default outline.

**Fix.** Mirror each hover style with its `focus-visible:` counterpart, in the renderer class strings only:

- `src/components/link.ts` anchor: add `focus-visible:scale-[1.02] focus-visible:text-accent`
- `src/components/socials.ts` anchors: add `focus-visible:text-accent`

No structural, token, or layout changes. New utilities are picked up automatically by the `pnpm css` precompile step (`@source "../"`).

**Tests.** Update the exact-match renderer assertions in `tests/components/render.test.ts` to the new class strings. No other test changes expected.

## 3. Out of scope

- Publish readiness (LICENSE, package metadata, prepublishOnly): deferred by user decision.
- Any other CLI flags or a11y work beyond these two items.
