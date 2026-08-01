# link-free — Theming/Styling Design Spec

**Date:** 2026-07-30
**Status:** Approved (design sections confirmed in brainstorming session)
**Builds on:** `2026-07-30-link-free-mvp-design.md` (MVP spec, §9 future scope item 1)

## 1. Goal

Give link-free pages a polished default look and user-controlled theming, while preserving every MVP invariant: single self-contained `index.html`, zero JavaScript, no external requests (no web fonts, no CDN CSS), and instant `npx` builds.

## 2. Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Who controls the look | Built-in **presets** + per-token **overrides** in config |
| Customizable tokens (v1) | Colors, typography, background image, shape & density |
| Layout variants | **Single** canonical centered layout; theming changes look, not structure |
| Dark mode | **Fixed** theme choice (light/dark presets), no `prefers-color-scheme` auto |
| CSS approach | **Tailwind v4**, precompiled at *package* build time |
| Tailwind compile timing | **Precompile into the CLI bundle** — zero Tailwind at user runtime |

**Why precompiled Tailwind:** end users never interact with Tailwind; their theming UX is presets + JSON token overrides, identical under any CSS strategy. Tailwind runs once when *we* build the package (`pnpm build`), scanning the component renderers and emitting minified CSS that ships inside the bundle as a string — same pattern as the inline SVG icons. Users' builds stay instant and the install stays light. Theme-dependent values are CSS custom properties (Tailwind v4's `@theme` binds utilities to `var(--lf-*)`), so user overrides work without recompiling: the CLI just emits a `:root { … }` block with the resolved values.

## 3. Config Contract

A 5th optional file, `link.free.config.json`, discovered in `--dir` next to the existing four:

```jsonc
{
  "theme": "dark",                          // preset name; default "light" when file absent
  "tokens": {                               // all optional overrides on top of the preset
    "accent": "#ff6b6b",                    // links hover, accents
    "background": "#0f0f0f",                // page background color
    "backgroundImage": "https://…/bg.jpg",  // optional; URL, layered under overlay
    "surface": "#1a1a1a",                   // link cards
    "text": "#fafafa",                      // primary text
    "font": "serif",                        // enum: system | serif | mono
    "radius": "lg",                         // enum: sm | md | lg | full — link cards
    "avatarRadius": "full",                 // enum: sm | md | lg | full — profile image
    "density": "compact"                    // enum: compact | comfortable
  }
}
```

Rules:

- `theme` (string enum, optional, default `"light"`): one of the shipped preset names. Unknown name → hard error listing valid presets.
- `tokens` (object, optional): every key optional; omitted keys fall back to the preset's value. Unknown keys stripped (forward-compat, same as block schemas).
- **Color tokens** (`accent`, `background`, `surface`, `text`): any non-empty CSS color string (hex/rgb/hsl/named). Validated as non-empty strings, not parsed — the browser is the authority on CSS colors.
- **Enum tokens** (`font`, `radius`, `avatarRadius`, `density`): strict zod enums, mapped to concrete values internally — users cannot inject arbitrary CSS through them.
- `backgroundImage`: valid URL (same `.url()` rule as other URL fields, schemes unrestricted per MVP spec §4.8).
- Missing file → `light` preset with no overrides. **Existing MVP users get a styled page for free on upgrade** — no config required.

## 4. Presets

Three presets ship in v1. Each is a **complete** token map (no inheritance).

| Preset | Character |
|---|---|
| `light` | Clean default: white/neutral background, dark text, blue accent, rounded cards |
| `dark` | Near-black background, light text, same accent family, solid near-black cards |
| `minimal` | Brutalist: no cards, underline links, sharp corners, system font |

The internal token map (per preset, overridable by users unless noted):

| CSS variable | From token | Notes |
|---|---|---|
| `--lf-bg` | `background` | page background color |
| `--lf-bg-image` | `backgroundImage` | emitted only when set |
| `--lf-surface` | `surface` | link card background |
| `--lf-text` | `text` | primary text |
| `--lf-text-muted` | — (preset only) | bio, descriptions, footer |
| `--lf-accent` | `accent` | links, hover states |
| `--lf-font` | `font` | enum → system font stack (no web fonts) |
| `--lf-radius` | `radius` | enum → rem value (cards) |
| `--lf-avatar-radius` | `avatarRadius` | enum → rem value |
| `--lf-spacing` | `density` | enum → vertical rhythm unit |
| `--lf-overlay` | — (preset only) | scrim opacity over `backgroundImage` |

`--lf-text-muted` and `--lf-overlay` are preset-only in v1 (not user-overridable) to keep the token surface small; they can be promoted later without breaking the contract.

**Background image handling:** when `backgroundImage` is set, the image covers the page background and a translucent scrim (`--lf-overlay` tinted from `surface`) sits between image and content so text stays readable. This is the one piece of "smart" CSS shipped.

## 5. Architecture

### 5.1 Authoring layer (package development)

- The four component renderers and `renderPage` gain **Tailwind utility classes** (mobile-first). Semantic structure from the MVP is unchanged — classes are additive.
- Theme-dependent utilities (`bg-surface`, `text-accent`, `rounded-card`…) are bound to CSS variables via Tailwind v4's CSS-first `@theme` block referencing `var(--lf-*)`, so utilities and variables stay in sync by construction.

### 5.2 Build pipeline (package build time)

- New `pnpm css` script: Tailwind v4 CLI scans `src/**/*.ts` (classes live in renderers), compiles + minifies against the `@theme` definitions, writes `src/theme/styles.css.ts` (a generated TS module exporting the CSS string — **generated and gitignored**, produced by `pnpm css` and `prebuild`).
- tsup inlines that string into `dist/cli.js` exactly like the icon SVGs. **No Tailwind code or engine ships to users.**

### 5.3 Theme module (runtime)

```
src/theme/
  presets.ts          # Record<PresetName, TokenMap> — light, dark, minimal
  resolveTheme.ts     # preset + user overrides → resolved map → ":root { … }" CSS text
  styles.css.ts       # GENERATED (gitignored): export const stylesCss: string
```

- `resolveTheme(config)` performs a **shallow merge** `{ ...presets[theme], ...userTokens }`, maps enums to concrete values, and emits the `:root` block. One pure function, fully unit-testable.

### 5.4 Pipeline integration

- `loadSections` also loads optional `link.free.config.json`, validated by a new `themeConfigSchema` in `src/schema/files.ts`. Absent → default config `{ theme: "light" }`.
- `renderPage` emits two `<style>` tags in `<head>`: the precompiled CSS first, then a second `<style>` with `:root { …resolved tokens… }` **after** it, so resolved variables win the cascade. Output remains one file, zero JS.

## 6. Error Handling

Same discipline as MVP (all `LoadError`, exit 1, no partial output):

| Case | Behavior |
|---|---|
| `link.free.config.json` absent | Default `{ theme: "light" }`, build succeeds |
| Malformed JSON | `…/link.free.config.json: invalid JSON — …` |
| Unknown preset | `link.free.config.json → theme: unknown theme "dracula" (valid: light, dark, minimal)` |
| Bad token value | `link.free.config.json → tokens.radius: Invalid enum value…` (zod issue path) |
| `backgroundImage` not a URL | `link.free.config.json → tokens.backgroundImage: Invalid url` |

## 7. Testing

Same three layers as MVP:

- **Schema tests** (`tests/schema/`): config validation — defaults applied, enums rejected, colors accepted as strings, unknown keys stripped.
- **Unit tests** (`tests/theme/`): `resolveTheme` — merge order (override beats preset), enum mapping, `:root` CSS contains resolved values, `backgroundImage` emitted only when set.
- **Integration** (`tests/build.test.ts` extension): fixture with config → output `<style>` contains the override value; fixture without config → `light` preset variables present.
- **Pipeline guard**: one test asserting the generated stylesheet string is non-empty and contains no raw `@tailwind`/`@apply` directives (catches a broken `pnpm css` step).
- `example/` gains a `link.free.config.json` (dark preset + one override) so the CLI smoke test exercises the whole path.

## 8. Explicitly Out of Scope (future)

- Layout variants (single canonical layout in v1)
- Auto dark mode via `prefers-color-scheme`
- User-overridable `--lf-text-muted` / `--lf-overlay`
- Web fonts (system stacks only — keeps pages self-contained and fast)
- Arbitrary utility classes in user config (would require runtime Tailwind compilation)
- TS/JS config module support (still JSON-only, per MVP spec §9)
