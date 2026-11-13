// Estado de carga del área de staff (ui.md): esqueleto mientras llegan las condiciones.
export default function Cargando() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      <div className="h-40 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      <span className="sr-only">Cargando condiciones…</span>
    </div>
  );
}
