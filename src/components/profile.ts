import { escapeHtml } from "../escapeHtml.js";
import type { ProfileBlock } from "../schema/blocks.js";

export function renderProfile({ image, name, bio }: ProfileBlock): string {
  const bioHtml = bio ? `\n  <p class="text-muted">${escapeHtml(bio)}</p>` : "";
  return `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="96" height="96" class="h-24 w-24 rounded-avatar object-cover">\n  <h1 class="text-2xl font-semibold text-ink">${escapeHtml(name)}</h1>${bioHtml}`;
}
