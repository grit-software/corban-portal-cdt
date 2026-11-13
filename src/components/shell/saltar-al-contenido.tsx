// Primer elemento enfocable de cada página: salta el encabezado y va a <main id="contenido">.
export function SaltarAlContenido() {
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-3 focus:text-primary focus:shadow-popover motion-reduce:transition-none"
    >
      Saltar al contenido
    </a>
  );
}
