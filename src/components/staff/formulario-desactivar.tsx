"use client";

// Desactivar a un miembro del staff pide confirmación y nombra a la persona antes de enviar.
export function FormularioDesactivar({
  id,
  nombre,
  accion,
}: {
  id: string;
  nombre: string;
  accion: (formulario: FormData) => Promise<void>;
}) {
  return (
    <form
      action={accion}
      onSubmit={(evento) => {
        if (!window.confirm(`¿Desactivar a ${nombre}? Perderá el acceso al portal de inmediato.`)) {
          evento.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`motivo-desactivar-${id}`}>
        Motivo para desactivar a {nombre}
      </label>
      <input
        id={`motivo-desactivar-${id}`}
        name="motivo"
        required
        placeholder="Motivo"
        className="min-h-11 rounded-lg border border-border px-3"
      />
      <button
        type="submit"
        className="min-h-11 rounded-lg border border-destructive px-3 text-destructive"
      >
        Desactivar
      </button>
    </form>
  );
}
