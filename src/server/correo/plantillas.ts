// Plantillas de correo en español (contratos.md §10). Ningún correo lleva número de documento
// ni datos financieros; el enlace lo construye quien llama con BETTER_AUTH_URL + ruta.

export type Plantilla = { asunto: string; html: string; texto: string };

function escapar(valor: string): string {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function envolver(titulo: string, parrafos: string[], enlace?: { texto: string; url: string }) {
  const botón = enlace
    ? `<p><a href="${escapar(enlace.url)}">${escapar(enlace.texto)}</a></p>`
    : "";
  const cuerpo = parrafos.map((p) => `<p>${escapar(p)}</p>`).join("");
  return (
    `<!doctype html><html lang="es"><body style="font-family:Inter,Arial,sans-serif;color:#1B1F23">` +
    `<h1 style="font-family:Poppins,Arial,sans-serif;font-size:20px">${escapar(titulo)}</h1>` +
    `${cuerpo}${botón}<p style="color:#6B7178;font-size:12px">Corban FC · No respondas a este correo.</p>` +
    `</body></html>`
  );
}

function textoPlano(parrafos: string[], enlace?: { texto: string; url: string }): string {
  return enlace
    ? [...parrafos, `${enlace.texto}: ${enlace.url}`].join("\n\n")
    : parrafos.join("\n\n");
}

function construir(
  asunto: string,
  parrafos: string[],
  enlace?: { texto: string; url: string },
): Plantilla {
  return {
    asunto,
    html: envolver(asunto, parrafos, enlace),
    texto: textoPlano(parrafos, enlace),
  };
}

export const plantillas = {
  otp: (datos: { codigo: string }): Plantilla =>
    construir(`Tu código de acceso a Corban CDT: ${datos.codigo}`, [
      `Tu código de acceso es ${datos.codigo}. Vence en 10 minutos.`,
      "Si no lo pediste, ignora este correo.",
    ]),

  invitacion: (datos: { nombreAsesor: string; enlace: string }): Plantilla =>
    construir(
      `${datos.nombreAsesor} te invita a abrir tu CDT con Corban FC`,
      ["Completa tus datos una sola vez y tramita tus solicitudes de CDT."],
      { texto: "Aceptar invitación", url: datos.enlace },
    ),

  pendiente_validacion: (datos: { codigo: string; enlace: string }): Plantilla =>
    construir(
      `Solicitud ${datos.codigo} lista para validar`,
      [`La solicitud ${datos.codigo} está lista para tu validación.`],
      { texto: "Ver solicitud", url: datos.enlace },
    ),

  devuelta: (datos: { codigo: string; enlace: string }): Plantilla =>
    construir(
      `Tu solicitud ${datos.codigo} necesita ajustes`,
      [`Tu solicitud ${datos.codigo} fue devuelta para que hagas algunos ajustes.`],
      { texto: "Revisar solicitud", url: datos.enlace },
    ),

  pendiente_firma: (datos: { codigo: string; enlace: string }): Plantilla =>
    construir(
      `Tus formatos de la solicitud ${datos.codigo} están listos para firmar`,
      ["Descarga tus formatos, fírmalos y sube la firma en el portal."],
      { texto: "Ver formatos", url: datos.enlace },
    ),

  firma_en_revision: (datos: { codigo: string; enlace: string }): Plantilla =>
    construir(
      `El cliente subió la firma de ${datos.codigo}`,
      [`La firma de la solicitud ${datos.codigo} está en revisión.`],
      { texto: "Revisar firma", url: datos.enlace },
    ),

  cdt_constituido: (datos: { numeroCdt: string; codigo: string; enlace: string }): Plantilla =>
    construir(
      `Tu CDT ${datos.numeroCdt} quedó constituido`,
      [`El CDT de la solicitud ${datos.codigo} ya quedó constituido con la entidad.`],
      { texto: "Ver mi portafolio", url: datos.enlace },
    ),
};
