# link-free

Tiny, open link-in-bio generator. Drop JSON files in a repo, run one command,
get a single static, semantic, SEO-first HTML page with zero JavaScript.

## Usage

```sh
npx link-free init             # scaffold the config files in your project
npx link-free build            # generate dist/index.html
npx link-free build --dir . --out dist
```

`init` writes starter versions of every config file (with editor `$schema`
URLs) and refuses to overwrite existing ones unless you pass `--force`.

Config files (all optional; missing file = section omitted):

| File | Purpose |
| --- | --- |
| `link.site.json` | Page-level SEO: title, description, lang, canonicalUrl, ogImage |
| `link.header.json` | `profile` (image, name, bio) + `socials` (icon links) blocks |
| `link.body.json` | `link` blocks (title, url, description) |
| `link.footer.json` | `text` blocks |

See `example/` for a complete config. Design spec: `docs/superpowers/specs/2026-07-30-link-free-mvp-design.md`. Theming spec: `docs/superpowers/specs/2026-07-30-link-free-theming-design.md`.

## Theming

Add an optional `link.free.config.json` to pick a preset theme and override
individual design tokens:

```json
{
  "theme": "dark",
  "tokens": { "accent": "#f472b6", "radius": "lg" }
}
```

Presets: `light` (default), `dark`, `minimal`. Token overrides (all optional):
`accent`, `background`, `backgroundImage` (URL or local path), `surface`, `text` (any CSS color),
`font` (`system` | `serif` | `mono`), `radius` / `avatarRadius` (`sm` | `md` |
`lg` | `full`), `density` (`compact` | `comfortable`). CSS is precompiled and
inlined with zero JavaScript — output is a single HTML page, plus an
`assets/` folder when you reference local images (see below).

## Local assets

Image fields (`profile.image`, `ogImage`, `backgroundImage`) accept either an
absolute URL or a local path relative to your config directory (e.g.
`./avatar.png`). Local files are copied into an `assets/` folder inside the
output directory at build time and references are rewritten automatically. A
missing file or a path outside the config directory fails the build with a
clear error. A local `ogImage` is rewritten to an absolute URL when
`canonicalUrl` is set; without it the `og:image` stays relative, which social
crawlers cannot fetch.

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
