// Documentos de la solicitud. En E2-T3 solo informa; E2-T6 lo amplía con los formatos y la firma.
export function DocumentosSolicitud({ estado }: { estado: string }) {
  const listos = estado === "pendiente_firma" || estado === "firma_en_revision";
  return (
    <section aria-labelledby="titulo-documentos" className="flex flex-col gap-3">
      <h2 id="titulo-documentos" className="text-lg font-semibold">
        Tus formatos
      </h2>
      <p className="text-muted-foreground">
        {listos
          ? "Tus formatos están disponibles para descargar."
          : "Tus formatos aparecerán aquí cuando tu asesor apruebe la solicitud."}
      </p>
    </section>
  );
}
