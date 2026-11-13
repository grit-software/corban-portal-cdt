// Catálogos del asistente (docs/referencia/contratos.md §6). Puros: sin I/O, sin Intl.
// Cada entrada es [valor, etiqueta]; el valor es lo que se guarda, la etiqueta lo que se muestra.

export const CATALOGOS = {
  tipo_doc: [
    ["CC", "Cédula de ciudadanía"],
    ["CE", "Cédula de extranjería"],
    ["TI", "Tarjeta de identidad"],
    ["PAS", "Pasaporte"],
    ["NUIP", "NUIP"],
  ],
  tipo_cdt: [
    ["desmaterializado", "Desmaterializado"],
    ["fisico", "Físico"],
  ],
  periodicidad: [
    ["vencimiento", "Al vencimiento"],
    ["mensual", "Mensual"],
    ["bimestral", "Bimestral"],
    ["trimestral", "Trimestral"],
    ["semestral", "Semestral"],
    ["anual", "Anual"],
  ],
  forma_pago: [
    ["transferencia", "Transferencia / consignación"],
    ["cheque", "Cheque"],
    ["efectivo", "Efectivo"],
    ["debito", "Débito de cuenta"],
  ],
  sexo: [
    ["F", "Femenino"],
    ["M", "Masculino"],
  ],
  estado_civil: [
    ["soltero", "Soltero(a)"],
    ["casado", "Casado(a)"],
    ["union", "Unión libre"],
    ["viudo", "Viudo(a)"],
    ["divorciado", "Divorciado(a)"],
    ["separado", "Separado(a)"],
  ],
  nivel_educ: [
    ["ninguno", "Ninguno"],
    ["primaria", "Primaria"],
    ["bachillerato", "Bachillerato"],
    ["tecnico", "Técnico"],
    ["tecnologo", "Tecnólogo"],
    ["universitario", "Universitario"],
    ["posgrado", "Posgrado"],
  ],
  tipo_vivienda: [
    ["propia", "Propia"],
    ["arrendada", "Arrendada"],
    ["familiar", "Familiar"],
  ],
  ocupacion: [
    ["empleado", "Empleado"],
    ["independiente", "Independiente"],
    ["pensionado", "Pensionado / jubilado"],
    ["rentista", "Rentista de capital"],
    ["hogar", "Hogar"],
    ["estudiante", "Estudiante"],
    ["desempleado", "Desempleado"],
  ],
  contrato: [
    ["indefinido", "Término indefinido"],
    ["fijo", "Término fijo"],
    ["obra", "Obra o labor"],
    ["prestacion", "Prestación de servicios"],
  ],
  declara_renta: [
    ["si", "Sí"],
    ["no", "No"],
  ],
  cta_tipo: [
    ["ahorros", "Ahorros"],
    ["corriente", "Corriente"],
  ],
} as const;

export type Catalogo = keyof typeof CATALOGOS;

// Valores de un catálogo como tupla, para z.enum.
export function valoresDe(catalogo: Catalogo): [string, ...string[]] {
  const [primero, ...resto] = CATALOGOS[catalogo].map(([valor]) => valor);
  if (primero === undefined) {
    throw new Error(`El catálogo ${catalogo} está vacío`);
  }
  return [primero, ...resto];
}

// Etiqueta para mostrar; si el valor no existe, se muestra tal cual.
export function etiqueta(catalogo: Catalogo, valor: string): string {
  const fila = (CATALOGOS[catalogo] as readonly (readonly [string, string])[]).find(
    ([v]) => v === valor,
  );
  return fila?.[1] ?? valor;
}
