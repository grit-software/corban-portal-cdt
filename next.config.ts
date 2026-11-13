import type { NextConfig } from "next";

// output "standalone": el paso 1 ejecuta .next/standalone/server.js y el Dockerfile (paso 20)
// copia esa carpeta. La raíz se fija en el directorio del proyecto para que un lockfile en un
// directorio padre no desplace la ruta de server.js.
// Cabeceras de seguridad de todas las rutas (E3-T5). `'unsafe-eval'` solo en desarrollo.
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const CABECERAS_SEGURIDAD = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: CABECERAS_SEGURIDAD }];
  },
  // SDKs de Azure: se quedan fuera del bundle del servidor. @azure/identity arrastra "open" →
  // powershell-utils, que Turbopack no puede resolver en Windows (E2-T5).
  serverExternalPackages: ["@azure/identity", "@azure/storage-blob"],
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
