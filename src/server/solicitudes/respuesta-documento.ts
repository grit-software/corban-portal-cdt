// Respuesta de descarga de un documento. fs: bytes con content-disposition attachment.
// azure: 302 a la URL firmada de 5 minutos (api-v1.md: nunca se expone storage_path).
export function respuestaDescarga(
  resultado: { tipo: "bytes"; bytes: Uint8Array; nombre: string } | { tipo: "url"; url: string },
): Response {
  if (resultado.tipo === "url") {
    return new Response(null, { status: 302, headers: { location: resultado.url } });
  }
  return new Response(resultado.bytes as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${resultado.nombre}"`,
    },
  });
}
