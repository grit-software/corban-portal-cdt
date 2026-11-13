import type { MetadataRoute } from "next";

// Manifest de la PWA (E3-T4). Los íconos salen de /iconos/[tamano].
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Corban CDT",
    short_name: "Corban CDT",
    start_url: "/mi-cuenta",
    display: "standalone",
    background_color: "#F5F6F7",
    theme_color: "#1D2226",
    lang: "es-CO",
    icons: [
      { src: "/iconos/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
