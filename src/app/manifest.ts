import type { MetadataRoute } from "next";

// Ikonica sa početnog ekrana telefona otvara servis portal.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Gastro Oprema – Servis",
    short_name: "Gastro Servis",
    description: "Prijava kvara i praćenje servisnih naloga za klijente Gastro Opreme",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e8772a",
    lang: "sr",
    orientation: "portrait",
    icons: [
      { src: "/gastro-servis-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/gastro-servis-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/gastro-servis-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
