import { escapeHtml } from "../escapeHtml.js";
import type { LinkBlock } from "../schema/blocks.js";

export function renderLink({ title, url, description }: LinkBlock): string {
  const desc = description
    ? `<small class="mt-1 block text-center text-sm text-muted">${escapeHtml(description)}</small>`
    : "";
  return `<li><a href="${escapeHtml(url)}" class="lf-link block rounded-card bg-surface px-5 py-4 text-center font-medium text-ink shadow-sm transition hover:scale-[1.02] hover:text-accent focus-visible:scale-[1.02] focus-visible:text-accent">${escapeHtml(title)}</a>${desc}</li>`;
}
