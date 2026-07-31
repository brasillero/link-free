import { escapeHtml } from "../escapeHtml.js";
import type { LinkBlock } from "../schema/blocks.js";

export function renderLink({ title, url, description }: LinkBlock): string {
  const desc = description ? `<small>${escapeHtml(description)}</small>` : "";
  return `<li><a href="${escapeHtml(url)}">${escapeHtml(title)}</a>${desc}</li>`;
}
