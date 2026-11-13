import { PERIODICIDADES } from "@/server/db/schema";

// Normaliza una fila leída del Excel según el mapeo de columnas (E3-T2). Devuelve los datos listos
// para el upsert o la lista de errores de la fila. No toca la base de datos.

export type Mapeo = Record<string, string>; // encabezado de columna -> destino
export type EntidadRef = { id: string; nombre: string };

export type DatosCliente = {
  tipoDoc: string;
  numDoc: string;
  nombre: string;
  email: string;
  celular: string | null;
  perfil: Record<string, string>;
};

export type DatosCdt = {
  entidadId: string;
  numeroCdt: string;
  valor: number;
  tasaEa: string;
  fechaApertura: string;
  fechaVenc: string;
  periodicidad: (typeof PERIODICIDADES)[number];
  estado: string;
};

export type FilaNormalizada = { cliente: DatosCliente; cdt: DatosCdt | null };

export type ResultadoFila = { ok: true; fila: FilaNormalizada } | { ok: false; errores: string[] };

const CAMPOS_FIJOS_CLIENTE = new Set(["tipo_doc", "num_doc", "nombres", "email", "celular"]);

export function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function fechaDesdePartes(anio: number, mes: number, dia: number): string | null {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

// Acepta Date de exceljs, serial de Excel (días desde 1899-12-30), dd/mm/yyyy y yyyy-mm-dd.
// Devuelve yyyy-mm-dd o null si la fecha no existe (p. ej. 31/02/2026).
export function fechaISO(valor: unknown): string | null {
  if (valor instanceof Date) {
    return fechaDesdePartes(valor.getUTCFullYear(), valor.getUTCMonth() + 1, valor.getUTCDate());
  }
  if (typeof valor === "number") {
    const dias = Math.floor(valor);
    if (dias < 1 || dias > 2958465) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + dias * 86_400_000);
    return fechaDesdePartes(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = texto(valor);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmy) return fechaDesdePartes(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) return fechaDesdePartes(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  return null;
}

// Valor en pesos enteros: acepta 5000000, "5.000.000", "$ 5,000,000".
function valorEntero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isInteger(valor) && valor > 0 ? valor : null;
  const limpio = texto(valor).replace(/[$\s.,]/g, "");
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 ? n : null;
}

// Tasa efectiva anual como texto con 4 decimales (numeric(6,4)).
function tasaEa(valor: unknown): string | null {
  const s = typeof valor === "number" ? String(valor) : texto(valor).replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 100 ? n.toFixed(4) : null;
}

function buscarEntidad(valor: string, entidades: EntidadRef[]): EntidadRef | undefined {
  const clave = sinTildes(valor);
  return entidades.find((e) => e.id === valor || sinTildes(e.nombre) === clave);
}

export function normalizarFila(
  celdas: Record<string, unknown>,
  mapeo: Mapeo,
  entidades: EntidadRef[],
): ResultadoFila {
  // Destino -> valor de la celda de la fila (si la columna está mapeada).
  const porDestino = new Map<string, unknown>();
  for (const [encabezado, destino] of Object.entries(mapeo)) {
    if (destino === "ignorar" || porDestino.has(destino)) continue;
    porDestino.set(destino, celdas[encabezado]);
  }
  const v = (destino: string) => porDestino.get(destino);
  const errores: string[] = [];

  const numDoc = texto(v("cliente.num_doc"));
  if (!numDoc) errores.push("documento vacío");
  const tipoDoc = texto(v("cliente.tipo_doc")).toUpperCase();
  if (!tipoDoc) errores.push("falta el tipo de documento");
  const nombre = texto(v("cliente.nombres"));
  if (!nombre) errores.push("falta el nombre");
  const email = texto(v("cliente.email"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push("correo inválido");
  const celular = texto(v("cliente.celular")) || null;

  const perfil: Record<string, string> = {};
  for (const [destino, valor] of porDestino) {
    if (!destino.startsWith("cliente.")) continue;
    const clave = destino.slice("cliente.".length);
    if (CAMPOS_FIJOS_CLIENTE.has(clave)) continue;
    const t = texto(valor);
    if (t) perfil[clave] = t;
  }

  let cdt: DatosCdt | null = null;
  const hayCdt =
    [...porDestino.keys()].some((d) => d.startsWith("cdt.")) && texto(v("cdt.numero_cdt")) !== "";
  if (hayCdt) {
    const entidadTexto = texto(v("cdt.entidad"));
    const entidad = entidadTexto ? buscarEntidad(entidadTexto, entidades) : undefined;
    if (!entidad) errores.push("entidad desconocida");
    const valor = valorEntero(v("cdt.valor"));
    if (valor === null) errores.push("valor inválido");
    const tasa = tasaEa(v("cdt.tasa_ea"));
    if (tasa === null) errores.push("tasa inválida");
    const apertura = fechaISO(v("cdt.fecha_apertura"));
    if (apertura === null) errores.push("fecha de apertura inválida");
    const venc = fechaISO(v("cdt.fecha_venc"));
    if (venc === null) errores.push("fecha de vencimiento inválida");
    const periodicidadTexto = texto(v("cdt.periodicidad")).toLowerCase();
    const periodicidad = PERIODICIDADES.find((p) => p === periodicidadTexto);
    if (!periodicidad) errores.push("periodicidad inválida");
    const estado = texto(v("cdt.estado")).toLowerCase() || "vigente";

    if (
      errores.length === 0 &&
      entidad &&
      valor !== null &&
      tasa !== null &&
      apertura !== null &&
      venc !== null &&
      periodicidad !== undefined
    ) {
      cdt = {
        entidadId: entidad.id,
        numeroCdt: texto(v("cdt.numero_cdt")),
        valor,
        tasaEa: tasa,
        fechaApertura: apertura,
        fechaVenc: venc,
        periodicidad,
        estado,
      };
    }
  }

  if (errores.length > 0) return { ok: false, errores };
  return {
    ok: true,
    fila: {
      cliente: { tipoDoc, numDoc, nombre, email, celular, perfil },
      cdt,
    },
  };
}

// Validación del mapeo completo antes de procesar: destinos conocidos y documento obligatorio.
export function erroresDeMapeo(mapeo: Mapeo, esDestino: (d: string) => boolean): string[] {
  const errores: string[] = [];
  const destinos = Object.values(mapeo);
  for (const destino of destinos) {
    if (!esDestino(destino)) errores.push(`destino desconocido: ${destino}`);
  }
  if (!destinos.includes("cliente.num_doc"))
    errores.push("falta la columna de número de documento");
  if (!destinos.includes("cliente.tipo_doc")) errores.push("falta la columna de tipo de documento");
  return errores;
}
