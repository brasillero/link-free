import type { ValidatedBlock } from "../components/registry.js";
import type { Sections } from "./loadSections.js";

function findBlock(blocks: ValidatedBlock[] | null, component: string): ValidatedBlock | undefined {
  return blocks?.find((b) => b.component === component);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Absolutize a relative (post-asset-rewrite) value against the canonical URL. */
function absolutize(value: string, canonicalUrl: string | undefined): string {
  if (!canonicalUrl || /^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `${canonicalUrl.replace(/\/$/, "")}/${value.replace(/^\.\//, "")}`;
}

/**
 * schema.org ProfilePage JSON-LD for the page, or null when there is no
 * profile block. Structured data only — not executable JavaScript.
 */
export function buildJsonLd(sections: Sections): string | null {
  const profile = findBlock(sections.header, "profile");
  const name = profile && asString(profile.name);
  if (!profile || !name) return null;

  const entity: Record<string, unknown> = { "@type": "Person", name };

  const image = asString(profile.image);
  if (image) entity.image = absolutize(image, sections.site.canonicalUrl);

  const bio = asString(profile.bio);
  if (bio) entity.description = bio;

  if (sections.site.canonicalUrl) entity.url = sections.site.canonicalUrl;

  const socials = findBlock(sections.header, "socials");
  const sameAs = Array.isArray(socials?.links)
    ? (socials.links as unknown[])
        .map((l) => asString((l as Record<string, unknown>).url))
        .filter((u): u is string => Boolean(u))
    : [];
  if (sameAs.length > 0) entity.sameAs = sameAs;

  const data = { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: entity };
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}
