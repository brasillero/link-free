# link-free — MVP Design Spec

**Date:** 2026-07-30
**Status:** Approved (design sections confirmed in brainstorming session)

## 1. Vision

`link-free` is a tiny, open, self-hostable link-in-bio generator (a Linktree alternative). A user drops JSON files into a repository, runs `npx link-free build`, and gets a single static, semantic, SEO-optimized `index.html` with **zero JavaScript** — maximally crawlable by bots and indexers by default.

## 2. MVP Scope (what we build now)

The engine/core only: read config files, validate them, render a single unstyled-but-semantic HTML page.

- No styling/theming (documented as future scope, section 7).
- Asset copying: shipped, see 2026-08-01 asset-copying spec.
- Mobile-first semantic structure; CSS comes later with theming.

## 3. CLI

```
npx link-free build [--dir <path>] [--out <path>]
```

- `--dir`: directory scanned for config files. Default: current working directory.
- `--out`: output directory for `index.html`. Default: `dist`.
- Exit code `0` on success, `1` on any validation/IO error.
- Renders fully in memory; the output file is written only once, on success. No partial output.

## 4. Config Contract

Four optional JSON files discovered in `--dir`. **A missing file = that section is omitted from the output.** A file with an empty `blocks` array is also omitted. All four missing = hard error: "no link.*.json files found in \<dir\>".

Every section file is an object with a `blocks` array. Each block declares its `component` type; a registry maps component name → zod schema + render function. The object wrapper leaves room for per-section settings when theming lands.

### 4.1 `link.site.json` — page-level SEO (optional)

```json
{
  "title": "Jane Doe — Links",
  "description": "All my links in one place.",
  "lang": "en",
  "canonicalUrl": "https://links.janedoe.dev",
  "ogImage": "https://links.janedoe.dev/og.png"
}
```

- `title` (string, optional), `description` (string, optional), `lang` (string, optional, default `"en"`), `canonicalUrl` (URL, optional), `ogImage` (URL, optional).
- Title fallback chain when absent: profile `name` → `"Links"`.

### 4.2 `link.header.json`

```json
{
  "blocks": [
    {
      "component": "profile",
      "image": "https://example.com/avatar.png",
      "name": "Jane Doe",
      "bio": "optional one-liner"
    },
    {
      "component": "socials",
      "links": [
        { "icon": "github", "url": "https://github.com/jane", "label": "GitHub" },
        { "icon": "x", "url": "https://x.com/jane", "label": "X" }
      ]
    }
  ]
}
```

- **`profile`**: `image` (URL, required), `name` (string, required), `bio` (string, optional).
- **`socials`**: `links` (array, required) of `{ icon, url, label }`; `icon` must be in the built-in icon set, `url` a valid URL, `label` a string (used for `aria-label` and fallback text).

### 4.3 `link.body.json`

```json
{
  "blocks": [
    { "component": "link", "title": "My blog", "url": "https://blog.janedoe.dev", "description": "optional" }
  ]
}
```

- **`link`**: `title` (string, required), `url` (URL, required), `description` (string, optional).

### 4.4 `link.footer.json`

```json
{ "blocks": [ { "component": "text", "text": "© 2026 Jane Doe" } ] }
```

- **`text`**: `text` (string, required).

### 4.5 Built-in icon set (inline SVG)

`github`, `x`, `instagram`, `linkedin`, `youtube`, `tiktok`, `mastodon`, `website` (generic globe). Icons are inline SVG strings shipped in the package; unknown icon name = hard error listing valid names.

### 4.6 Unknown keys / forward compatibility

Zod schemas **strip** unknown keys, so config files written against future versions still build with older CLIs (unknown keys ignored, not errors).

### 4.7 Section component constraints

Each section file accepts only its designated components — this guarantees valid HTML (e.g. a `link` block always lands inside the body's `<ul>`):

| File | Allowed components |
|---|---|
| `link.header.json` | `profile`, `socials` |
| `link.body.json` | `link` |
| `link.footer.json` | `text` |

A block whose `component` is valid but not allowed in that section is a hard error: `link.header.json → blocks[0]: component "link" not allowed here (valid: profile, socials)`.

### 4.8 URL validation

URL fields use zod's `.url()` (anything `new URL()` accepts). Schemes are intentionally **not** restricted to http(s): configs are authored by the page owner (no untrusted input), and `mailto:`/`tel:` links are legitimate for a link-in-bio page. HTML-escaping still applies to all rendered attribute values.

## 5. Architecture

Single Node ESM package, TypeScript, bundled with tsup. One-way data flow: **discover → validate → render → write**.

```
src/
  cli.ts                  # entry: parses argv (build, --dir, --out), calls engine, exit 0/1
  engine/
    loadSections.ts       # finds link.*.json in --dir, parses JSON, validates via registry
    renderPage.ts         # composes rendered sections into the full HTML document
  components/
    registry.ts           # component name → { schema, render }; lookup + unknown-component error
    profile.ts            # avatar <img>, <h1> name, bio <p>
    socials.ts            # <nav> of inline-SVG icon links with rel="me"
    link.ts               # body link: <a> with title + optional description
    text.ts               # footer text block
    icons.ts              # name → inline SVG string
  schema/
    blocks.ts             # zod schemas per block; TS types via z.infer
    files.ts              # per-file schemas (site object, { blocks: [...] } wrappers)
  escapeHtml.ts           # single escaping helper used by every renderer
```

Design rules:

- **Component registry.** Each component is `{ schema: ZodType, render: (props) => string }` — a pure function returning an HTML string. No DOM, no browser APIs. Validating a section file = walking its blocks, looking each up in the registry, parsing with that block's schema.
- **Zod is the single source of truth** for both runtime validation and TypeScript types (`z.infer`), so the type-safe contract cannot drift from runtime checks.
- **Only runtime dependency: zod**, bundled into the CLI by tsup — `npx link-free` stays one fast download.
- **Escaping:** all user-provided strings pass through `escapeHtml` before reaching output; renderers never interpolate raw text.
- Toolchain: TypeScript + tsup (build) + vitest (test), Node ESM, pnpm.

## 6. HTML Output & SEO Defaults

One self-contained file: `dist/index.html`. Zero JavaScript, no external CSS, no web fonts.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>…site.title…</title>
  <meta name="description" content="…site.description…">
  <link rel="canonical" href="…">            <!-- only if canonicalUrl set -->
  <meta property="og:title" content="…">
  <meta property="og:description" content="…">
  <meta property="og:type" content="profile">
  <meta property="og:image" content="…">     <!-- only if ogImage set -->
  <meta name="twitter:card" content="summary">
  <meta name="robots" content="index, follow">
</head>
<body>
  <header>…profile + socials <nav>…</header>  <!-- omitted if no link.header.json -->
  <main><ul>…body links…</ul></main>           <!-- omitted if no link.body.json -->
  <footer>…footer text…</footer>               <!-- omitted if no link.footer.json -->
</body>
</html>
```

- Social links render inside `<nav aria-label="Social links">`, each `<a>` with `rel="me"` and an `aria-label` from its `label`.
- Body links are a real `<ul><li><a>` list — fully crawlable without JavaScript.
- `canonical` and `og:image` are emitted only when configured.
- `og:title`/`og:description` fall back the same way as `<title>`/description.

## 7. Error Handling

| Case | Behavior |
|---|---|
| Missing config file(s) | Section omitted; build succeeds |
| All four files missing | Hard error: "no link.*.json files found in \<dir\>", exit 1 |
| Malformed JSON | Error names the file and parse position, exit 1 |
| Schema validation failure | One line per issue: `link.body.json → blocks[2].url: Invalid url`, exit 1 |
| Unknown `component` | Error listing valid component names, exit 1 |
| Unknown `icon` | Error listing valid icon names, exit 1 |

Output is rendered fully in memory and written once on success — no partial files.

## 8. Testing

vitest, three layers:

- **Schema tests** (`tests/schema/`): each block schema accepts valid input; rejects missing required fields and invalid URLs; strips unknown keys.
- **Renderer tests** (`tests/components/`): each `render` output asserted as an HTML string — correct tags/attributes, escaping (`<script>` in a name becomes inert), optional fields omitted cleanly.
- **Integration test** (`tests/build.test.ts`): fixture directory with all four files → engine end-to-end → assert output contains each section and the SEO meta tags; assert sections are omitted when their file is deleted; malformed JSON and unknown component produce the expected error messages.

No snapshot tests — explicit assertions on semantic structure, so tests double as documentation of the output contract.

## 9. Future Scope (documented, NOT in this MVP)

1. **Theming** via a separate `link.free.config.json` (or `.ts`): a type-safe contract to customize component appearance — colors, fonts, layout variants, background image. A theme = alternative renderers registered under the same component names, which the registry architecture already supports.
2. **TS/JS config modules** (`link.header.ts` exporting a typed object) as an alternative to JSON.
3. **JSON Schema generation** from the zod schemas, for editor autocomplete on the JSON files.
4. ~~**Asset copying**: local image paths copied into `dist` and rewritten in output.~~ Shipped — see 2026-08-01 asset-copying spec.
5. **SEO extras**: JSON-LD structured data (`ProfilePage`), favicon, `theme-color`, sitemap.
6. **More components**: headings, dividers, embedded media, etc. — registered the same way as the MVP four.
