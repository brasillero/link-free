import { escapeHtml } from "../escapeHtml.js";
import type { TextBlock } from "../schema/blocks.js";

export function renderText({ text }: TextBlock): string {
  return `<p>${escapeHtml(text)}</p>`;
}
