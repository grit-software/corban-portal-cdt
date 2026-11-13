import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { SaltarAlContenido } from "@/components/shell/saltar-al-contenido";
import "./globals.css";

// Fuentes locales (ui.md): Inter variable y Poppins 500/600/700. display swap evita texto invisible.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const poppins = localFont({
  src: [
    { path: "./fonts/poppins500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Corban CDT",
  description: "Portal de CDT de Corban FC: abre y sigue tus CDT en línea.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-CO" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <SaltarAlContenido />
        {children}
      </body>
    </html>
  );
}
