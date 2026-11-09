import type { MetadataRoute } from "next";
import { THEME_COLORS } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Swift",
    short_name: "Swift",
    description: "Move forward, one task at a time.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    lang: "az",
    categories: ["productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Text task", short_name: "Text", url: "/new/text", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Voice task", short_name: "Voice", url: "/new/voice", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
