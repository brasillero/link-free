import { z } from "zod";

export const ICON_NAMES = [
  "github",
  "x",
  "instagram",
  "linkedin",
  "youtube",
  "tiktok",
  "mastodon",
  "website",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const profileBlockSchema = z
  .object({
    component: z.literal("profile"),
    image: z.string().url(),
    name: z.string().min(1),
    bio: z.string().optional(),
  })
  .strip();

export const socialLinkSchema = z
  .object({
    icon: z.enum(ICON_NAMES),
    url: z.string().url(),
    label: z.string().min(1),
  })
  .strip();

export const socialsBlockSchema = z
  .object({
    component: z.literal("socials"),
    links: z.array(socialLinkSchema).min(1),
  })
  .strip();

export const linkBlockSchema = z
  .object({
    component: z.literal("link"),
    title: z.string().min(1),
    url: z.string().url(),
    description: z.string().optional(),
  })
  .strip();

export const textBlockSchema = z
  .object({
    component: z.literal("text"),
    text: z.string().min(1),
  })
  .strip();

export type ProfileBlock = z.infer<typeof profileBlockSchema>;
export type SocialLink = z.infer<typeof socialLinkSchema>;
export type SocialsBlock = z.infer<typeof socialsBlockSchema>;
export type LinkBlock = z.infer<typeof linkBlockSchema>;
export type TextBlock = z.infer<typeof textBlockSchema>;
