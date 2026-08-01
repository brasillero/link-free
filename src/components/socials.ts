import { escapeHtml } from "../escapeHtml.js";
import type { SocialsBlock } from "../schema/blocks.js";
import { ICONS } from "./icons.js";

export function renderSocials({ links }: SocialsBlock): string {
  const items = links
    .map(
      (l) =>
        `    <a href="${escapeHtml(l.url)}" rel="me" aria-label="${escapeHtml(l.label)}">${ICONS[l.icon]}</a>`,
    )
    .join("\n");
  return `<nav aria-label="Social links">\n${items}\n  </nav>`;
}
