import Link from "next/link";
import type { ReactNode } from "react";

// Shell de las páginas públicas: cabecera de marca y <main id="contenido"> (ui.md).
export function ShellPublico({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-heading text-lg font-semibold text-foreground">
            Corban CDT
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/ingreso" className="flex min-h-11 items-center text-primary">
              Ingresar
            </Link>
          </nav>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-2xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
