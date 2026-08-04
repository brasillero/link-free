# link-free — JSON-LD Structured Data Design Spec

**Date:** 2026-08-04
**Status:** Approved (design presented; auto mode, no blocking gate)
**Builds on:** MVP spec §9 future scope ("SEO extras: JSON-LD structured data (ProfilePage)")

## 1. Goal

Emit schema.org structured data so search engines understand the page is a personal profile and can consolidate the owner's identity across platforms. No new config surface: everything is derived from existing config files.

## 2. Output

When (and only when) the header contains a `profile` block, `renderPage` emits in `<head>`:

```html
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "mainEntity": {
    "@type": "Person",
    "name": "Jane Doe",
    "image": "https://links.janedoe.dev/assets/avatar.png",
    "description": "Engineer, writer, coffee enthusiast.",
    "url": "https://links.janedoe.dev",
    "sameAs": [
      "https://github.com/janedoe",
      "https://x.com/janedoe",
      "https://janedoe.dev"
    ]
  }
}</script>
```

This is structured data, not executable JavaScript. The zero-JS guarantee (no executable code, nothing to crawl-render) is unchanged.

## 3. Field mapping

| JSON-LD field | Source | Notes |
|---|---|---|
| `mainEntity.name` | profile `name` | always present (required by profile schema) |
| `mainEntity.image` | profile `image` | post-asset-rewrite value; absolutized against `canonicalUrl` when it is a relative `assets/...` path |
| `mainEntity.description` | profile `bio` | omitted when bio absent |
| `mainEntity.url` | site `canonicalUrl` | omitted when absent |
| `mainEntity.sameAs` | socials block link `url`s, in order | omitted when no socials block |

No profile block in the header → no JSON-LD block at all.

`Person` is the hardcoded entity type in v1 (the package targets personal link-in-bio pages). An `Organization` variant can come later with an explicit config hint.

## 4. Escaping

The JSON is serialized with `JSON.stringify(data, null, 2)` and then every `<` is replaced with `\u003c` (valid JSON string escape, invisible to parsers) so a value like `</script>` in a name or URL can never terminate the script element. No HTML-escaping (script raw-text context would not decode entities).

## 5. Architecture

- New module `src/engine/jsonld.ts`: `buildJsonLd(sections: Sections): string | null` — pure function returning the full `<script …>…</script>` string or null. Reads profile/socials blocks via the same `ValidatedBlock` traversal helpers style as renderPage.
- `renderPage` calls it and includes the result in `<head>` when non-null.
- Because it runs inside `renderPage`, it sees post-`processAssets` references; the canonicalUrl absolutization for relative `assets/...` image paths mirrors the ogImage rule.

## 6. Testing

- **Unit tests** (`tests/engine/jsonld.test.ts`): full mapping with all fields; bio absent → no description key; no canonicalUrl → no url key and relative image stays relative; canonicalUrl + rewritten asset image → absolutized; no profile → null; escaping — a name containing `</script>` produces `\u003c/script>` and never a literal closing tag; output parses as JSON after stripping the tags.
- **Integration** (`tests/build.test.ts` or renderPage tests): full fixture page contains a parseable `application/ld+json` block with the expected name and sameAs entries.

## 7. Out of scope

- `Organization` or other entity types
- Breadcrumb/FAQ/other schema types
- Config opt-out flag (emit-when-profile is the only rule; can be added later if asked)
