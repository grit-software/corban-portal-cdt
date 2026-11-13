// Formatos de la solicitud (versión actual). Antes de la aprobación solo informa; después lista
// los PDF generados para descargar. Cada descarga va por la API y verifica su huella.

export type DocumentoVista = {
  id: string;
  tipo: string;
  nombreArchivo: string;
  version: number;
  estado: string;
};

export function DocumentosSolicitud({
  solicitudId,
  estado,
  documentos,
}: {
  solicitudId: string;
  estado: string;
  documentos: DocumentoVista[];
}) {
  const generados = documentos.filter((d) => d.tipo === "generado" && d.estado !== "rechazado");
  const aprobada =
    estado !== "borrador" && estado !== "devuelta" && estado !== "pendiente_validacion";
  return (
    <section aria-labelledby="titulo-documentos" className="flex flex-col gap-3">
      <h2 id="titulo-documentos" className="text-lg font-semibold">
        Tus formatos
      </h2>
      {generados.length === 0 || !aprobada ? (
        <p className="text-muted-foreground">
          Tus formatos aparecerán aquí cuando tu asesor apruebe la solicitud.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {generados.map((d) => (
            <li key={d.id}>
              <a
                href={`/api/v1/solicitudes/${solicitudId}/documentos/${d.id}`}
                className="flex min-h-11 items-center rounded-lg bg-card px-4 text-primary shadow-card"
              >
                Descargar {d.nombreArchivo}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
