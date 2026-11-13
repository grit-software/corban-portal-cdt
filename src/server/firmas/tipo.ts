// Tipo de archivo por sus bytes iniciales, nunca por el MIME que declara el cliente.
export type TipoArchivo = "pdf" | "jpeg" | "png";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function tipoPorBytes(bytes: Uint8Array): TipoArchivo | null {
  const empieza = (firma: number[]) => firma.every((b, i) => bytes[i] === b);
  if (empieza([0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (empieza([0xff, 0xd8, 0xff])) return "jpeg";
  if (empieza(PNG)) return "png";
  return null;
}
