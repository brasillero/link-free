# link-free — JSON Schema Generation Design Spec

**Date:** 2026-08-04
**Status:** Approved (design presented in chat; user approved proceeding)
**Builds on:** MVP spec §9 future scope ("JSON Schema generation from the zod schemas")

## 1. Goal

Ship JSON Schema documents for the five config files so editors (VS Code and anything else honoring `$schema`) give users autocomplete and inline validation while writing configs. The schemas are **generated from the zod schemas** and guarded against drift, so the zod source of truth stays single.

## 2. Deliverables

A tracked `schemas/` directory at the repo root with five generated files:

| File | Describes |
|---|---|
| `link.site.schema.json` | `link.site.json` (siteFileSchema) |
| `link.header.schema.json` | `link.header.json` — blocks union of `profile` / `socials` |
| `link.body.schema.json` | `link.body.json` — blocks of `link` |
| `link.footer.schema.json` | `link.footer.json` — blocks of `text` |
| `link.free.config.schema.json` | `link.free.config.json` (themeConfigSchema) |

Each generated document carries a stable `$id` of the form `https://raw.githubusercontent.com/brasillero/link-free/master/schemas/<name>` so a user can put `"$schema": "<that URL>"` at the top of their config and get autocomplete without installing anything.

## 3. How generation works

- New dev dependency: `zod-to-json-schema` (dev-only; never ships in the CLI bundle).
- New source exports in `src/schema/files.ts`: `headerFileSchema`, `bodyFileSchema`, `footerFileSchema` — proper `z.object({ blocks: z.array(z.discriminatedUnion("component", [...])) })` schemas built from the existing block schemas. These are richer than the loose `sectionFileSchema` used at runtime (which intentionally stays loose so loadSections can produce curated per-block errors). They exist for generation and documentation, and they encode the same per-section component rules as `SECTION_COMPONENTS`.
- New script `scripts/generate-schemas.mjs`: converts the five schemas via `zod-to-json-schema`, injects the `$id` fields, writes the files with 2-space formatting.
- New package.json script: `"schemas": "node scripts/generate-schemas.mjs"`.

## 4. Drift guard

A vitest test runs the generator into a temp directory and asserts the output is byte-identical to the tracked `schemas/` files. If someone changes a zod schema without regenerating, the test fails. (Running the generator rather than diffing `git status` keeps the test hermetic.)

**Strictness note:** the generated schemas emit `additionalProperties: false` (zod-to-json-schema's default), which is stricter than the runtime, where unknown keys are stripped silently. This is intentional: the editor should flag typos, while the runtime stays forward-compatible with configs written against future versions.

## 5. Per-section consistency guard

A test asserts each exported file schema accepts/rejects the same component sets as `SECTION_COMPONENTS` (e.g. `headerFileSchema` rejects a `link` block, accepts `profile`/`socials`), so the generation-side schemas can't drift from the runtime rule.

## 6. README

Short "Editor autocomplete" section showing the `"$schema": "https://raw.githubusercontent.com/brasillero/link-free/master/schemas/link.header.schema.json"` line for each file.

## 7. Out of scope

- Publishing schemas to schemastore.org (can come later; the raw-URL `$id` works today).
- Versioned schema URLs (master is fine while the package is pre-1.0).
