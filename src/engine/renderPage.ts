import { renderBlock, type ValidatedBlock } from "../components/registry.js";
import { escapeHtml } from "../escapeHtml.js";
import type { Sections } from "./loadSections.js";

function findProp(blocks: ValidatedBlock[] | null, component: string, prop: string): string | undefined {
  const block = blocks?.find((b) => b.component === component);
  const value = block?.[prop];
  return typeof value === "string" ? value : undefined;
}

function wrapSection(tag: string, blocks: ValidatedBlock[] | null, inner = ""): string | null {
  if (!blocks || blocks.length === 0) return null;
  const body = blocks.map(renderBlock).join("\n  ");
  return `<${tag}>${inner}\n  ${body}\n${inner}</${tag}>`;
}

export function renderPage(sections: Sections): string {
  const { site, header, body, footer } = sections;

  const title = site.title ?? findProp(header, "profile", "name") ?? "Links";
  const description = site.description ?? findProp(header, "profile", "bio");

  const meta: string[] = [
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(title)}</title>`,
  ];
  if (description) meta.push(`  <meta name="description" content="${escapeHtml(description)}">`);
  if (site.canonicalUrl) meta.push(`  <link rel="canonical" href="${escapeHtml(site.canonicalUrl)}">`);
  meta.push(`  <meta property="og:title" content="${escapeHtml(title)}">`);
  if (description) meta.push(`  <meta property="og:description" content="${escapeHtml(description)}">`);
  meta.push('  <meta property="og:type" content="profile">');
  if (site.ogImage) meta.push(`  <meta property="og:image" content="${escapeHtml(site.ogImage)}">`);
  meta.push('  <meta name="twitter:card" content="summary">');
  meta.push('  <meta name="robots" content="index, follow">');

  // Body links are wrapped in a real list so they are crawlable without JS.
  const bodyHtml =
    body && body.length > 0
      ? `<main>\n  <ul>\n    ${body.map(renderBlock).join("\n    ")}\n  </ul>\n</main>`
      : null;

  const parts = [
    "<!doctype html>",
    `<html lang="${escapeHtml(site.lang ?? "en")}">`,
    "<head>",
    ...meta,
    "</head>",
    "<body>",
    wrapSection("header", header, "  "),
    bodyHtml,
    wrapSection("footer", footer, "  "),
    "</body>",
    "</html>",
  ];

  return parts.filter((p): p is string => p != null).join("\n") + "\n";
}
