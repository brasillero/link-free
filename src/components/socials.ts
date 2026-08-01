import { escapeHtml } from "../escapeHtml.js";
import type { SocialsBlock } from "../schema/blocks.js";
import { ICONS } from "./icons.js";

export function renderSocials({ links }: SocialsBlock): string {
  const items = links
    .map(
      (l) =>
        `    <a href="${escapeHtml(l.url)}" rel="me" aria-label="${escapeHtml(l.label)}" class="text-ink transition hover:text-accent focus-visible:text-accent [&_svg]:block [&_svg]:h-6 [&_svg]:w-6">${ICONS[l.icon]}</a>`,
    )
    .join("\n");
  return `<nav aria-label="Social links" class="flex items-center gap-5">\n${items}\n  </nav>`;
}
