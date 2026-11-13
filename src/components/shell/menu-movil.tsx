"use client";

import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type ElementoMenu = { href: string; etiqueta: string };

// Menú del staff bajo 1024 px: un Sheet con la misma lista que la barra lateral.
export function MenuMovil({ elementos }: { elementos: ElementoMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger className="flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 text-white lg:hidden">
        Menú
      </SheetTrigger>
      <SheetContent side="left" className="bg-navy text-white">
        <SheetTitle className="text-white">Corban CDT</SheetTitle>
        <nav aria-label="Secciones" className="mt-6 flex flex-col gap-1">
          {elementos.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              onClick={() => setAbierto(false)}
              className="flex min-h-11 items-center rounded-lg px-3 text-white hover:bg-navy-dark motion-reduce:transition-none"
            >
              {e.etiqueta}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
