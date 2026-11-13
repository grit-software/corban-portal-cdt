import type { DocKey } from "./mapeo.ts";

// Nombre del archivo descargado: <prefijo>_<apellido1 sin tildes ni símbolos>_v<versión>.pdf
// (contratos.md §5).
const PREFIJO: Record<DocKey, string> = {
  ban_vinc: "Ban100_Vinculacion",
  ban_orden: "Ban100_Orden_de_inversion",
  colte_vinc: "Coltefinanciera_Vinculacion",
  colte_cdt: "Coltefinanciera_CDT",
  juris: "Juriscoop_Solicitud",
  mmujer: "MundoMujer_Solicitud",
};

export function nombreArchivoPdf(
  docKey: DocKey,
  apellido1: string | undefined,
  version: number,
): string {
  const apellido =
    (apellido1 ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]/g, "") || "cliente";
  return `${PREFIJO[docKey]}_${apellido}_v${version}.pdf`;
}
