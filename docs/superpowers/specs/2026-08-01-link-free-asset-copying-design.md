# link-free — Asset Copying Design Spec

**Date:** 2026-08-01
**Status:** Approved in brainstorming session
**Builds on:** MVP spec (replaces its "no asset copying" note), theming spec

## 1. Goal

Let configs reference local image files (e.g. `./avatar.png`) instead of only hosted URLs. The build copies referenced local files into the output directory and rewrites the references so the emitted HTML points at the copies. Pages built from a repo with local assets just work.

## 2. Asset references

Three config fields accept an **asset reference**: `profile.image` (`link.header.json`), `site.ogImage` (`link.site.json`), `tokens.backgroundImage` (`link.free.config.json`).

An asset reference is either:

- **Absolute URL** (any scheme, per MVP spec §4.8): passes through to output unchanged. Existing configs are unaffected.
- **Relative local path** (e.g. `./avatar.png`, `images/bg.jpg`): resolved against `--dir`. Must resolve to a location **inside** `--dir` (paths escaping via `..` are rejected).

Schema relaxation: the three fields change from `z.string().url()` to a non-empty string (the `<` rejection from the theming hardening stays). URL-vs-local distinction is made at build time: a value that parses as an absolute URL with a scheme is remote; anything else is a local path. Documented examples use forward-slash relative paths.

## 3. Build behavior

New pipeline step `processAssets(sections, dir, outDir)` in `src/engine/assets.ts`, called by `build()` between `loadSections` and `renderPage`.

For each local reference found in the three known locations:

1. Resolve against `dir`. Missing file → hard `LoadError` naming the config location and the path checked, e.g. `link.header.json → blocks[0].image: file not found: ./avatar.png (resolved to <abs path>)`. Exit 1, no partial output.
2. Copy to `<outDir>/assets/<basename>`.
3. Rewrite the value in the loaded sections to `assets/<basename>` (a root-relative-to-output path used verbatim in the emitted HTML).

**Collision rules:**

- Same source file referenced from multiple places → copied once, both references rewritten.
- Two different source files mapping to the same basename → hard `LoadError` naming both sources, e.g. `asset name collision: images/a.png and photos/a.png both map to assets/a.png`.

Remote references are never copied or rewritten.

## 4. Code shape

- `src/schema/blocks.ts` + `src/schema/files.ts`: relax the three fields (non-empty string + `<` rejection; drop `.url()` on them).
- `src/engine/assets.ts` (new): `processAssets(sections, dir, outDir): Promise<Sections>`. File discovery from the three known locations, existence checks, copy, rewrite. Testable with tmp fixture dirs.
- `src/engine/build.ts`: one-line insertion of the step.

## 5. Errors

| Case | Behavior |
|---|---|
| Referenced local file missing | `LoadError` naming config field + resolved path, exit 1 |
| Path escapes `--dir` via `..` | `LoadError` naming the field, exit 1 |
| Basename collision (different sources) | `LoadError` naming both sources, exit 1 |
| Remote URL | untouched, no copy |

All errors occur before any output file is written (no partial output, per the established write-once rule).

## 6. Testing

- **Schema tests**: relaxed fields accept local paths and URLs; reject empty strings and `<`.
- **Unit tests** (`tests/engine/assets.test.ts`, tmp fixtures): local ref copied + rewritten; remote ref untouched; missing file error message; traversal rejection; collision error; same-file-twice dedupe.
- **Integration** (`tests/build.test.ts`): fixture with a real local image file → output HTML references `assets/<name>` and the file exists in the output dir.
- `example/` gains a small local `avatar.png` and `link.header.json` switches to `./avatar.png`, so the CLI smoke test exercises the feature.

## 7. Out of scope

- Image optimization/resizing/format conversion.
- Non-image assets (fonts, videos, favicon).
- Watching/incremental rebuilds.
