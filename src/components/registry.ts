import type { ZodTypeAny } from "zod";
import {
  linkBlockSchema,
  profileBlockSchema,
  socialsBlockSchema,
  textBlockSchema,
  type LinkBlock,
  type ProfileBlock,
  type SocialsBlock,
  type TextBlock,
} from "../schema/blocks.js";
import { renderLink } from "./link.js";
import { renderProfile } from "./profile.js";
import { renderSocials } from "./socials.js";
import { renderText } from "./text.js";

/** A validated block as it flows from loadSections to renderPage. */
export type ValidatedBlock = { component: string } & Record<string, unknown>;

interface Component {
  schema: ZodTypeAny;
  render: (props: unknown) => string;
}

export const registry: Record<string, Component> = {
  profile: { schema: profileBlockSchema, render: (p) => renderProfile(p as ProfileBlock) },
  socials: { schema: socialsBlockSchema, render: (p) => renderSocials(p as SocialsBlock) },
  link: { schema: linkBlockSchema, render: (p) => renderLink(p as LinkBlock) },
  text: { schema: textBlockSchema, render: (p) => renderText(p as TextBlock) },
};

export const COMPONENT_NAMES = Object.keys(registry);

export function renderBlock(block: ValidatedBlock): string {
  return registry[block.component].render(block);
}
