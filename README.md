# link-free

Tiny, open link-in-bio generator. Write a few TypeScript config files, run one
command, get a single static, semantic, SEO-first HTML page with zero
JavaScript.

## Usage

```sh
npx link-free init             # scaffold a project (package.json + typed configs)
npm install                    # or pnpm/yarn — gives your editor the config types
npx link-free build            # generate dist/index.html
```

`init` writes `package.json`, `tsconfig.json`, and five starter config files.
It refuses to overwrite existing config files unless you pass `--force`.

## Config files

All optional; a missing file means that section is omitted. Each file has a
typed default export checked by your editor against the package's types:

| File | Type | Purpose |
| --- | --- | --- |
| `site.link.ts` | `SiteFile` | Page-level SEO: title, description, lang, canonicalUrl, ogImage |
| `header.link.ts` | `HeaderFile` | `profile` (image, name, bio) + `socials` (icon links) blocks |
| `body.link.ts` | `BodyFile` | `link` blocks (title, url, description) |
| `footer.link.ts` | `FooterFile` | `text` blocks |
| `config.link.ts` | `ThemeConfig` | Theme preset + token overrides |

```ts
// header.link.ts
import type { HeaderFile } from "link-free";

export default {
  blocks: [
    { component: "profile", image: "./avatar.png", name: "Your Name" },
  ],
} satisfies HeaderFile;
```

## Theming

`config.link.ts` picks a preset (`light` default, `dark`, `minimal`) and
overrides tokens: `accent`, `background`, `backgroundImage` (URL or local
path), `surface`, `text` (any CSS color), `font` (`system` | `serif` |
`mono`), `radius` / `avatarRadius` (`sm` | `md` | `lg` | `full`), `density`
(`compact` | `comfortable`). CSS is precompiled and inlined with zero
JavaScript — output is a single HTML page, plus an `assets/` folder when you
reference local images.

## Local assets

Image fields (`profile.image`, `ogImage`, `backgroundImage`) accept either an
absolute URL or a local path relative to your config directory. Local files
are copied into an `assets/` folder inside the output directory and
references are rewritten. A missing file or a path outside the config
directory fails the build with a clear error. A local `ogImage` is rewritten
to an absolute URL when `canonicalUrl` is set; without it the `og:image`
stays relative, which social crawlers cannot fetch.

See `example/` for a complete config. Design specs: `docs/superpowers/specs/`.
