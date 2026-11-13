"use client";

export default function ErrorGerencia({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3">
      <p>No se pudieron cargar los reportes.</p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 w-fit rounded-lg bg-primary px-4 text-primary-foreground"
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
