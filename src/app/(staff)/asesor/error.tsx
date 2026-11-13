"use client";

// Error del área del asesor: mensaje claro y reintento, sin detalles técnicos al usuario.
export default function ErrorAsesor({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">No pudimos cargar esta vista</h1>
      <p className="text-muted-foreground">
        Intenta de nuevo. Si el problema sigue, avisa al coordinador.
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 self-start rounded-lg bg-primary px-4 font-medium text-primary-foreground"
      >
        Reintentar
      </button>
    </div>
  );
}
