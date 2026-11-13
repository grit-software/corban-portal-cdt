import Link from "next/link";
import type { ReactNode } from "react";

// Shell del área de cliente, mobile-first: en móvil la navegación va abajo (pulgar).
export function ShellCliente({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/mi-cuenta" className="font-heading text-lg font-semibold text-foreground">
            Corban CDT
          </Link>
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-2xl px-4 py-6">
        {children}
      </main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-card md:hidden"
      >
        <ul className="mx-auto flex max-w-2xl justify-around">
          <li>
            <Link
              href="/mi-cuenta"
              className="flex min-h-11 min-w-11 items-center px-4 text-sm font-medium text-primary"
            >
              Inicio
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}
