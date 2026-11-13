import type { NextConfig } from "next";

// output "standalone": el paso 1 ejecuta .next/standalone/server.js y el Dockerfile (paso 20)
// copia esa carpeta. La raíz se fija en el directorio del proyecto para que un lockfile en un
// directorio padre no desplace la ruta de server.js.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // SDKs de Azure: se quedan fuera del bundle del servidor. @azure/identity arrastra "open" →
  // powershell-utils, que Turbopack no puede resolver en Windows (E2-T5).
  serverExternalPackages: ["@azure/identity", "@azure/storage-blob"],
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
