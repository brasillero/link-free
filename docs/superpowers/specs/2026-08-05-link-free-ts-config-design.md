# link-free — TypeScript Config (v0.2.0) Design Spec

**Date:** 2026-08-05
**Status:** Approved (design + file naming confirmed in chat)
**Replaces:** JSON config format (breaking change, before first publish)

## 1. Goal

Config files become TypeScript modules, type-checked by the user's editor against the package's shipped types. No `$schema` URLs, no remote downloads, no SchemaStore. `init` scaffolds a real project (package.json + tsconfig + starter configs) so the typed experience works out of the box.

## 2. Config format

Five optional files, same discovery semantics as before (absent file = section omitted; all absent = error):

| File | Export | Type |
|---|---|---|
| `site.link.ts` | default | `SiteFile` |
| `header.link.ts` | default | `HeaderFile` |
| `body.link.ts` | default | `BodyFile` |
| `footer.link.ts` | default | `FooterFile` |
| `config.link.ts` | default | `ThemeConfig` |

Shape:

```ts
// header.link.ts
import type { HeaderFile } from "link-free";

export default {
  blocks: [
    { component: "profile", image: "./avatar.png", name: "Your Name" },
  ],
} satisfies HeaderFile;
```

- Types are inferred from the existing zod schemas (`z.infer` of `siteFileSchema`, `headerFileSchema`, `bodyFileSchema`, `footerFileSchema`, `themeConfigSchema`), so editor types and runtime validation cannot drift.
- `satisfies` style, no `defineConfig` helpers (zero runtime cost).
- The data contract is unchanged: same fields, same enums, same per-section component rules, same validation and error messages at build time.

## 3. Loading

- New dependency: `jiti` (bundled into the CLI via tsup `noExternal`; adds roughly 1 MB to installs).
- `loadSections` keeps its structure: for each of the five files, load the module's default export via jiti, then run the existing zod validation. A module that throws on load (syntax error, bad import) becomes a `LoadError` naming the file.
- **Migration guard:** if a directory contains `link.*.json` config files but no `.link.ts` files, the build fails with: `JSON configs are no longer supported as of v0.2.0 — convert them to <section>.link.ts modules`. Exit 1.

## 4. Package changes

- tsup builds two entries: `src/cli.ts` (bin) and `src/index.ts` (new, re-exports the config types). `dts` enabled for the index entry.
- `package.json` gains `exports`: `{ ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }` (bin wiring unchanged).
- Version → `0.2.0`.
- `zod` moves back to runtime dependencies? No: it is bundled, so it stays a devDependency (noExternal already covers it). Only `jiti` is added (also devDep + bundled).

## 5. `init` (framework-style scaffolding)

`link-free init [--dir] [--force]` now writes:

- `package.json` — `{ "name": <dir basename, sanitized>, "private": true, "type": "module", "scripts": { "build": "link-free build" }, "devDependencies": { "link-free": "^0.2.0" } }`. If a `package.json` already exists it is NOT overwritten and NOT counted as a collision; a note is printed.
- `tsconfig.json` — minimal (`module: ESNext, moduleResolution: Bundler, strict`) only if none exists; never overwritten.
- The five `[section].link.ts` starter files, each importing its type from `link-free` and using `satisfies`. Same placeholder content as the JSON starters.
- Collision rule (unchanged): any `.link.ts` target exists → abort listing them unless `--force`.
- Next-steps output: `run pnpm install (or npm/yarn install), then pnpm build`.

## 6. Removals

- JSON config loading (all of it).
- `schemas/` directory, `scripts/generate-schemas.ts`, the `schemas` package script, drift-guard tests, and the `zod-to-json-schema` + `vite-node` devDependencies.
- README JSON Schema section (replaced with TS config docs) and the `$schema` lines from starter content.
- `example/` JSON files become `.link.ts` files.

Kept: per-section zod schemas (`headerFileSchema` etc.) and their consistency test — they back both validation and the inferred types.

## 7. Error handling

| Case | Behavior |
|---|---|
| `.link.ts` has a syntax/load error | `error: <file>: failed to load — <loader message>`, exit 1 |
| Module has no default export | `error: <file>: expected a default export`, exit 1 |
| Content fails zod validation | same curated messages as today, exit 1 |
| Only `link.*.json` present | migration guard error, exit 1 |
| Nothing present | existing `no config files found` error, exit 1 |

## 8. Testing

- Loader tests: TS module loads + validates; load error message; missing default export; JSON-migration guard.
- Updated loadSections/build tests to write `.link.ts` fixtures instead of JSON.
- Init tests updated for package.json/tsconfig/starter `.ts` content (starter configs must typecheck against the real types and validate against the real schemas).
- Example converted; CLI smoke builds from it.
- Type-export test: `dist/index.d.ts` exposes the five config types (verified at build verification time).

## 9. Out of scope

- JS configs (`.mjs`), ESM runtime import without jiti, watch mode.
- Keeping JSON as a fallback format (full migration was chosen).
