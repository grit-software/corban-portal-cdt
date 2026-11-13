// Estado de carga del área del asesor (ui.md): esqueleto mientras llegan las solicitudes.
export default function Cargando() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      <span className="sr-only">Cargando solicitudes…</span>
    </div>
  );
}
