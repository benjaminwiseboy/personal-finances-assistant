import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Colors match the dark ink surface so the
// splash screen and status bar don't flash white on launch.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mes Finances",
    short_name: "Finances",
    description: "Suivez ce qui entre, ce qui sort, et ce qu’il vous reste.",
    lang: "fr",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0b10",
    theme_color: "#0d0b10",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Nouvelle transaction", url: "/transactions", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Budgets", url: "/budgets", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
