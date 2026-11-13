export default function CargandoGerencia() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <p className="text-muted-foreground">Cargando reportes…</p>
    </div>
  );
}
