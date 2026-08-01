import { escapeHtml } from "../escapeHtml.js";
import type { ProfileBlock } from "../schema/blocks.js";

export function renderProfile({ image, name, bio }: ProfileBlock): string {
  const bioHtml = bio ? `\n  <p>${escapeHtml(bio)}</p>` : "";
  return `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" width="96" height="96">\n  <h1>${escapeHtml(name)}</h1>${bioHtml}`;
}
