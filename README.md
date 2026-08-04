# link-free

Tiny, open link-in-bio generator. Drop JSON files in a repo, run one command,
get a single static, semantic, SEO-first HTML page with zero JavaScript.

## Usage

```sh
npx link-free build            # scan cwd, write dist/index.html
npx link-free build --dir . --out dist
```

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
`./avatar.png`). Local files are copied into `dist/assets/` at build time and
references are rewritten automatically. A missing file or a path outside the
config directory fails the build with a clear error.
