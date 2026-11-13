// Códigos de error de contratos.md §1 y su estado HTTP. Los servicios lanzan ErrorDominio;
// los route handlers lo traducen con respuestaError() (respuestas.ts).
export const HTTP_POR_CODIGO = {
  NO_AUTENTICADO: 401,
  PROHIBIDO: 403,
  CONSENTIMIENTO_REQUERIDO: 403,
  PERFIL_REQUERIDO: 403,
  USAR_MICROSOFT: 403,
  NO_ENCONTRADO: 404,
  TRANSICION_INVALIDA: 409,
  CONFLICTO: 409,
  DOCUMENTO_REGISTRADO: 409,
  CONDICION_SOLAPADA: 409,
  INVITACION_INVALIDA: 410,
  CARGA_DEMASIADO_GRANDE: 413,
  TIPO_NO_PERMITIDO: 415,
  VALIDACION: 422,
  SIN_CONDICION: 422,
  CONDICION_AMBIGUA: 422,
  MONTO_MINIMO: 422,
  MOTIVO_REQUERIDO: 422,
  FECHA_APERTURA_PASADA: 422,
  LIMITE_EXCEDIDO: 429,
  ERROR_INTERNO: 500,
} as const;

export type CodigoError = keyof typeof HTTP_POR_CODIGO;

export class ErrorDominio extends Error {
  readonly code: CodigoError;
  readonly fields: Record<string, string> | undefined;

  constructor(code: CodigoError, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ErrorDominio";
    this.code = code;
    this.fields = fields;
  }
}
