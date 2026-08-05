import type { HeaderFile } from "link-free";

export default {
  blocks: [
    {
      component: "profile",
      image: "./avatar.png",
      name: "Jane Doe",
      bio: "Engineer, writer, coffee enthusiast.",
    },
    {
      component: "socials",
      links: [
        { icon: "github", url: "https://github.com/janedoe", label: "GitHub" },
        { icon: "x", url: "https://x.com/janedoe", label: "X" },
        { icon: "website", url: "https://janedoe.dev", label: "Website" },
      ],
    },
  ],
} satisfies HeaderFile;
