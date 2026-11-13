"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

// Caché de consultas del área de cliente. 30 s de vida evita pedir las mismas opciones de tasa
// cada vez que se cambia de paso.
export function ProveedorConsultas({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
