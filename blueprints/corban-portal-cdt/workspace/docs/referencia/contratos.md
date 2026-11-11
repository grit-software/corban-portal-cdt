# Contratos de dominio — Corban CDT

> Copia de referencia, dentro del proyecto, de los contratos que fijan §5 y §8 del blueprint.
> Los epics apuntan aquí para no depender de `blueprint.md`. Si algo cambia, cambia en ambos
> lugares en el mismo commit. Nada aquí es opcional ni "sugerido".

## 1. Sobre de respuesta y códigos de error

Éxito: `{ "data": <payload> }` y, en listas paginadas, `{ "data": [...], "meta": { "pagina", "porPagina", "total" } }`.
Error (una sola forma, sin excepciones): `{ "error": { "code": "<CODIGO>", "message": "<texto en español>", "fields": { "<clave>": "<motivo>" } } }` — `fields` solo en `VALIDACION`.

| Código | HTTP | Cuándo |
|---|---|---|
| `NO_AUTENTICADO` | 401 | Sin sesión válida |
| `PROHIBIDO` | 403 | El actor ve el recurso pero la acción no le está permitida |
| `CONSENTIMIENTO_REQUERIDO` | 403 | Cliente sin consentimiento Ley 1581 de la versión vigente |
| `PERFIL_REQUERIDO` | 403 | Usuario cliente sin fila en `clientes` (debe completar el registro) |
| `USAR_MICROSOFT` | 403 | Un correo de staff pidió OTP: el staff entra solo con Microsoft |
| `NO_ENCONTRADO` | 404 | No existe **o** el actor no puede verlo (nunca 403 para recursos ajenos) |
| `TRANSICION_INVALIDA` | 409 | Acción no permitida desde el estado actual |
| `CONFLICTO` | 409 | Violación de unicidad de negocio (p. ej. `numero_cdt` repetido) |
| `DOCUMENTO_REGISTRADO` | 409 | Registro con (`tipo_doc`,`num_doc`) existente y otro correo |
| `CONDICION_SOLAPADA` | 409 | Condición de tasa que se cruza con otra vigente |
| `INVITACION_INVALIDA` | 410 | Token de invitación vencido, usado o inexistente |
| `CARGA_DEMASIADO_GRANDE` | 413 | Más de 10 archivos o más de 15 MB en total |
| `TIPO_NO_PERMITIDO` | 415 | Bytes iniciales que no son PDF, JPEG ni PNG |
| `VALIDACION` | 422 | Cuerpo inválido o campos obligatorios vacíos |
| `SIN_CONDICION` | 422 | Ninguna fila de `condiciones_tasa` aplica |
| `CONDICION_AMBIGUA` | 422 | Dos o más filas aplican |
| `MONTO_MINIMO` | 422 | Valor por debajo de `entidades.monto_minimo` |
| `MOTIVO_REQUERIDO` | 422 | Acción que exige motivo/observación llegó sin él |
| `FECHA_APERTURA_PASADA` | 422 | Aprobación con `fecha_apertura` anterior a hoy (America/Bogota) |
| `LIMITE_EXCEDIDO` | 429 | Límite de tasa superado (cabecera `Retry-After` en segundos) |
| `ERROR_INTERNO` | 500 | Cualquier excepción no prevista (se registra con request id, sin PII) |

Los servicios lanzan `ErrorDominio(codigo, mensaje, fields?)` (`src/server/authz/errores.ts`); los route
handlers lo traducen con `respuestaError()` según esta tabla. Las server actions devuelven
`{ ok: false, error: { code, message, fields? } }` con los mismos códigos.

## 2. Matriz de permisos (`can(actor, accion, recurso)`)

Alcance: **propio** = `recurso.clienteId === actor.clienteId`; **asignado** =
`recurso.asesorId === actor.staffId`; **todos** = sin filtro. "—" = denegado.
Si `can()` deniega `*.ver` el servicio responde `NO_ENCONTRADO`; si el actor puede ver pero no
actuar, `PROHIBIDO`. Las guardas de estado (§3) se evalúan después de `can()`.

| Acción | cliente | asesor | coordinador | gerencia | admin |
|---|---|---|---|---|---|
| `solicitud.ver` | propio | asignado | todos | todos | todos |
| `solicitud.crear` | propio | asignado | todos | — | — |
| `solicitud.editar` | propio | asignado | todos | — | — |
| `solicitud.enviar` | propio | asignado | todos | — | — |
| `solicitud.aprobar` | — | asignado | todos | — | — |
| `solicitud.devolver` | — | asignado | todos | — | — |
| `solicitud.cancelar` | — | asignado | todos | — | — |
| `solicitud.cargar_firma` | propio | asignado | todos | — | — |
| `solicitud.revisar_firma` | — | asignado | todos | — | — |
| `solicitud.enviar_entidad` | — | asignado | todos | — | — |
| `solicitud.constituir` | — | asignado | todos | — | — |
| `solicitud.reasignar` | — | — | todos | — | — |
| `documento.descargar` | propio | asignado | todos | — | todos |
| `cliente.ver` | propio | asignado | todos | — | todos |
| `cliente.invitar` | — | sí | sí | — | — |
| `cliente.reasignar` | — | — | sí | — | — |
| `portafolio.ver` | propio | asignado | todos | todos | todos |
| `condiciones.ver` | sí | sí | sí | sí | sí |
| `condiciones.administrar` | — | — | sí | — | — |
| `festivos.administrar` | — | — | sí | — | — |
| `importacion.ejecutar` | — | — | sí | — | sí |
| `reportes.ver` | — | — | sí | sí | — |
| `staff.administrar` | — | — | — | — | sí |

Notas: un `cliente` sin consentimiento vigente no supera ninguna acción salvo
`condiciones.ver` (el servicio responde `CONSENTIMIENTO_REQUERIDO`). Un staff inactivo no tiene
actor (sus sesiones se borran al desactivarlo).

## 3. Máquina de estados de la solicitud

| Acción | Desde | Hacia | Actor (además de `can()`) | Guarda y efectos |
|---|---|---|---|---|
| `enviar` | `borrador`, `devuelta` | `pendiente_validacion` | cliente dueño, asesor asignado, coordinador | Todos los obligatorios válidos (§6); el motor de cálculo devuelve una condición; actualiza `clientes.perfil` con las claves de perfil |
| `aprobar` | `pendiente_validacion` | `pendiente_firma` | asesor asignado, coordinador | `fecha_apertura` ≥ hoy; recalcula con el motor y **congela** `valor`, `plazo_dias`, `periodicidad`, `tasa_ea`, `fecha_apertura`, `fecha_venc`, `condicion_id`, `aprobada_at`, `aprobada_por`; `version_actual` = 1; crea `solicitud_versiones` 1; genera un PDF por `doc_key` de la entidad (versión 1) |
| `devolver` | `pendiente_validacion` | `devuelta` | asesor asignado, coordinador | `observacion` no vacía |
| `cargar_firma` | `pendiente_firma` | `firma_en_revision` | cliente dueño, asesor asignado, coordinador | 1–10 archivos, ≤ 15 MB, bytes PDF/JPEG/PNG; se guarda un único PDF tipo `firmado` versión = `version_actual` |
| `aceptar_firma` | `firma_en_revision` | `lista_para_enviar` | asesor asignado, coordinador | Existe un `firmado` `vigente` de la versión actual → pasa a `aceptado` |
| `rechazar_firma` | `firma_en_revision` | `pendiente_firma` | asesor asignado, coordinador | `motivo` no vacío → el `firmado` pasa a `rechazado` con `motivo_rechazo` |
| `enviar_entidad` | `lista_para_enviar` | `enviada_entidad` | asesor asignado, coordinador | `fecha_envio` obligatoria, `radicado` opcional |
| `constituir` | `enviada_entidad` | `cdt_constituido` | asesor asignado, coordinador | `numero_cdt`, `valor`, `tasa_ea`, `fecha_apertura`, `fecha_venc` finales; crea la fila de `cdts` (`origen` `solicitud`); `numero_cdt` repetido para la entidad → `CONFLICTO` |
| `cancelar` | todo estado salvo `cdt_constituido` y `cancelada` | `cancelada` | asesor asignado, coordinador | `motivo` no vacío → `motivo_cancelacion` |
| `editar_post_aprobacion` | `pendiente_firma`, `firma_en_revision`, `lista_para_enviar`, `enviada_entidad` | `pendiente_firma` | asesor asignado, coordinador | `motivo` no vacío; recalcula con la tabla **vigente hoy**; `version_actual` + 1; nueva `solicitud_versiones`; PDFs regenerados con la nueva versión; generados anteriores → `desactualizado`; firmados `vigente`/`aceptado` anteriores → `desactualizado`; diffs `{campo, antes, despues}` en `audit_events.metadata.cambios` |

Edición sin cambio de estado: el cliente edita (autoguardado por paso) solo en `borrador` y
`devuelta`; el asesor/coordinador edita en `borrador`, `devuelta` y `pendiente_validacion` con
`motivo` obligatorio (diffs en auditoría). `cdt_constituido` y `cancelada` son finales: ninguna
edición. Toda transición escribe, en la misma transacción, una fila de `solicitud_eventos`
(`tipo` `transicion`, `desde`, `hacia`, actor, nota) y una de `audit_events` con
`accion` = `solicitud.<acción>`. Cualquier combinación fuera de esta tabla → `TRANSICION_INVALIDA`.

Alerta de vigencia: en `pendiente_firma`, `firma_en_revision` y `lista_para_enviar`, si la
condición congelada tiene `vigente_hasta` anterior a hoy, el detalle del asesor devuelve
`alertaVigencia: true` ("La tasa aprobada perdió vigencia: edita la solicitud para tomar la
tasa actual como nueva versión").

## 4. Motor de cálculo (`src/server/condiciones/motor.ts`, puro)

Entrada: `{ entidad, filas, festivos, valor, plazoDias, periodicidad, fechaApertura }`
(`fechaApertura` ISO `yyyy-mm-dd`). Salida: `{ ok: true, condicionId, tasaEa, fechaVenc,
plazoMeses, plazoTxt, valorLetras }` o `{ ok: false, error: "MONTO_MINIMO" | "SIN_CONDICION" |
"CONDICION_AMBIGUA" }`.

1. `valor < entidad.montoMinimo` → `MONTO_MINIMO`.
2. Filas aplicables: misma entidad, `plazoDias` igual, `periodicidad` igual,
   `montoMin <= valor`, (`montoMax` nulo o `valor <= montoMax`), `vigenteDesde <= fechaApertura`,
   (`vigenteHasta` nulo o `fechaApertura <= vigenteHasta`). Cero → `SIN_CONDICION`; dos o más →
   `CONDICION_AMBIGUA`.
3. Vencimiento base (aritmética en UTC, sin horas):
   `calendario` = apertura + `plazoDias` días.
   `comercial_360` = apertura + `floor(plazoDias / 30)` meses (si el día no existe en el mes
   destino se usa el último día del mes) + `plazoDias % 30` días.
4. Ajuste: `siguiente_habil` avanza día a día mientras sea sábado, domingo o esté en `festivos`;
   `anterior_habil` retrocede igual; `ninguno` no cambia.
5. `plazoMeses = Math.round(plazoDias / 30)`; `plazoTxt = "<plazoDias> días"`;
   `valorLetras = valorEnLetras(valor)`.

### Casos fijos de `tests/unit/motor-calculo.test.ts`

| # | base | ajuste | festivos | apertura | plazo | `fechaVenc` esperada |
|---|---|---|---|---|---|---|
| 1 | calendario | ninguno | — | 2026-03-02 | 90 | 2026-05-31 |
| 2 | calendario | siguiente_habil | — | 2026-03-02 | 90 | 2026-06-01 |
| 3 | calendario | anterior_habil | — | 2026-03-02 | 90 | 2026-05-29 |
| 4 | calendario | siguiente_habil | 2026-06-01 | 2026-03-02 | 90 | 2026-06-02 |
| 5 | comercial_360 | ninguno | — | 2026-01-31 | 30 | 2026-02-28 |
| 6 | comercial_360 | siguiente_habil | — | 2026-01-31 | 30 | 2026-03-02 |
| 7 | comercial_360 | ninguno | — | 2026-01-15 | 45 | 2026-03-02 |

(2026-05-31 es domingo, 2026-02-28 es sábado, 2026-03-01 es domingo; el festivo del caso 4 es
un dato de prueba, no un festivo real.)

| `plazoDias` | `plazoMeses` |
|---|---|
| 90 | 3 |
| 45 | 2 |
| 100 | 3 |
| 180 | 6 |

| valor | `valorEnLetras` |
|---|---|
| 50000000 | `CINCUENTA MILLONES DE PESOS M/CTE` |
| 1234567 | `UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE PESOS M/CTE` |
| 21000000 | `VEINTIÚN MILLONES DE PESOS M/CTE` |
| 101000 | `CIENTO UN MIL PESOS M/CTE` |
| 1000 | `MIL PESOS M/CTE` |
| 100 | `CIEN PESOS M/CTE` |
| 0 | cadena vacía |

### `valorEnLetras` — port literal del POC

```ts
const U = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO",
  "DIECINUEVE", "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO",
  "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DEC = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA",
  "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function menorMil(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = c ? CEN[c] : "";
  if (r) {
    if (s) s += " ";
    if (r < 30) s += U[r];
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      s += DEC[d] + (u ? ` Y ${U[u]}` : "");
    }
  }
  return s;
}

function bajoMillon(n: number): string {
  const miles = Math.floor(n / 1000);
  const r = n % 1000;
  const partes: string[] = [];
  if (miles) partes.push(miles === 1 ? "MIL" : `${menorMil(miles)} MIL`);
  if (r) partes.push(menorMil(r));
  return partes.join(" ");
}

export function enLetras(n: number): string {
  if (!n || n >= 1e12) return "";
  const mm = Math.floor(n / 1e6);
  const resto = n % 1e6;
  let s = "";
  if (mm) s = mm === 1 ? "UN MILLÓN" : `${mm < 1000 ? menorMil(mm) : bajoMillon(mm)} MILLONES`;
  if (resto) s += (s ? " " : "") + bajoMillon(resto);
  if (mm && !resto) s += " DE";
  return s;
}

export function valorEnLetras(n: number): string {
  return n ? `${enLetras(n)} PESOS M/CTE` : "";
}
```

Formato de miles (sin `Intl`, para no depender de los datos ICU del runtime):
`formatoMiles(50000000)` = `50.000.000`; `formatoMiles(0)` = cadena vacía (como `money()` del POC,
sin prefijo `$`). Texto de tasa para los PDF: `tasaTexto("10.5000")` = `10,50` (dos decimales,
coma decimal).

## 5. Motor PDF (`src/server/pdf/`, port del POC)

Entradas: `docKey` ∈ `ban_vinc`, `ban_orden`, `colte_vinc`, `colte_cdt`, `juris`, `mmujer`;
`D` = resultado de `derivarDatosPdf(datos, congelado)`. Archivos: `assets/formatos/<docKey>.pdf`
y las filas de `assets/formatos/mapping.json[docKey]` seguidas de las de
`assets/formatos/mapping.cuenta-pago.json[docKey]` (si existe la clave). Ruta base:
`path.join(process.cwd(), "assets", "formatos")`. Salida: `{ bytes: Uint8Array, reporte:
{ notFound: string[], skipped: string[], text: number, checks: number } }`.

Algoritmo, en este orden exacto:

1. `PDFDocument.load(bytes, { ignoreEncryption: true })`, `form = pdf.getForm()`.
2. **Deduplicar widgets** (corrige el texto doble de Mundo Mujer): para cada `PDFTextField` con
   2+ widgets, recorrer `i` desde el último hasta 1; si existe `j < i` cuyo rectángulo difiere en
   menos de 3 pt en x, y, ancho **y** alto, tomar la referencia `Kids[i]`, quitarla del arreglo
   `Annots` de **todas** las páginas, `acroField.removeWidget(i)` y pasar al siguiente `i`.
3. **Limpiar valores de fábrica** de todos los campos (cada uno en try/catch): texto
   `setText(undefined)`; casilla `uncheck()`; radio `clear()`; lista/desplegable `clear()`.
4. **Aplicar el mapeo** fila por fila:
   - `t`: `setText(f, fmt === "money" ? formatoMiles(D[key]) : String(D[key] ?? ""))`.
   - `d`: `setText(f, parteFecha(D[key], part))` con `part` `d`→dd, `m`→mm, `y`→yyyy, otro→dd/mm/yyyy; vacío si no hay fecha.
   - `c`: si `D[key]` no es vacío y `mismo(D[key], val)` → `marcar(f)`.
   - `x`: `marcar(f)` siempre.
   - `s`: `setText(f, val)`.
   - `tv`: si `D[cond[0]] === cond[1]` (igualdad estricta) → `setText(f, fmt === "money" ? formatoMiles(D[key]) : D[key])`.
   - `ch`: `setText(f, String(D[key] ?? "").charAt(i))` (vacío si `i` está fuera de rango).
   `setText(nombre, valor)`: campo inexistente → `notFound.push(nombre)`; valor vacío → no hace
   nada; `PDFTextField` → `setText(limpiar(valor))`, `text++`; otro tipo → `skipped`.
   `marcar(nombre)`: inexistente → `notFound`; `PDFCheckBox` → `check()`; `PDFRadioGroup` →
   `select(getOptions()[0])`; `PDFTextField` → `setText("X")`; cada éxito `checks++`; otro → `skipped`.
   `limpiar(v)` reemplaza todo carácter fuera de U+0000–U+00FF por `?` (Helvetica/WinAnsi).
   `mismo(a, b)`: ambos a texto → `trim()` → minúsculas → NFD sin diacríticos → `o` final
   cambiada por `a`; iguales. (`soltero`≡`Soltera`, `si`≡`Sí`.)
5. `form.updateFieldAppearances(await pdf.embedFont(StandardFonts.Helvetica))`, `pdf.save()`.

`notFound` debe quedar vacío en los 6 documentos (todas las filas de ambos mapeos se verificaron
contra sus PDF). Nombre del archivo: `<prefijo>_<apellido1 sin tildes ni símbolos>_v<versión>.pdf`
con prefijos `Ban100_Vinculacion`, `Ban100_Orden_de_inversion`, `Coltefinanciera_Vinculacion`,
`Coltefinanciera_CDT`, `Juriscoop_Solicitud`, `MundoMujer_Solicitud`.

`derivarDatosPdf(datos, congelado)` produce `D` con todas las claves de `datos` más:
`valor` (número), `fecha_apertura`, `fecha_venc`, `plazo_dias` (texto), `plazo_meses`
(`Math.round(dias/30)`), `plazo_txt` (`"<dias> días"`), `tasa_ea` (`tasaTexto`), `periodicidad`,
`periodicidad_txt` (`vencimiento` → `Al vencimiento`, resto según catálogo), `valor_letras`,
`nombre_completo` (nombre1 nombre2 apellido1 apellido2 sin vacíos), `lugar_nac`
(`nac_ciudad, nac_pais`), `ciudad_depto_res`, `ciudad_depto_trab`, `contrato_txt` (etiqueta del
catálogo), `cta_tipo_txt` (`Ahorros`/`Corriente`), `total_ingresos` (`ingresos + otros_ingresos`
o vacío si da 0), `patrimonio` (`activos − pasivos` si alguno es distinto de 0, si no vacío) y
`ingresos`, `otros_ingresos`, `egresos`, `activos`, `pasivos` como número (vacío si 0).

Quedan en blanco por diseño (se avisa en la pantalla de documentos): declaraciones PEP,
FATCA/CRS, moneda extranjera, origen de fondos, referencias, cónyuge, firmas y huellas.

## 6. Catálogos y campos del asistente

Catálogos (valor → etiqueta):

- `tipo_doc`: CC Cédula de ciudadanía · CE Cédula de extranjería · TI Tarjeta de identidad · PAS Pasaporte · NUIP NUIP
- `tipo_cdt`: desmaterializado Desmaterializado · fisico Físico
- `periodicidad`: vencimiento Al vencimiento · mensual Mensual · bimestral Bimestral · trimestral Trimestral · semestral Semestral · anual Anual
- `forma_pago`: transferencia Transferencia / consignación · cheque Cheque · efectivo Efectivo · debito Débito de cuenta
- `sexo`: F Femenino · M Masculino
- `estado_civil`: soltero Soltero(a) · casado Casado(a) · union Unión libre · viudo Viudo(a) · divorciado Divorciado(a) · separado Separado(a)
- `nivel_educ`: ninguno · primaria · bachillerato · tecnico Técnico · tecnologo Tecnólogo · universitario · posgrado
- `tipo_vivienda`: propia · arrendada · familiar
- `ocupacion`: empleado · independiente · pensionado Pensionado / jubilado · rentista Rentista de capital · hogar · estudiante · desempleado
- `contrato`: indefinido Término indefinido · fijo Término fijo · obra Obra o labor · prestacion Prestación de servicios
- `declara_renta`: si Sí · no No
- `cta_tipo`: ahorros Ahorros · corriente Corriente

Pasos y claves (todas se guardan como texto en `solicitudes.datos`; dinero = solo dígitos;
fechas = `yyyy-mm-dd`). **Obligatorias en negrita.**

| Paso | Claves |
|---|---|
| CDT | **entidad** (columna `entidad_id`), **valor**, **plazo_dias** (de las opciones vigentes), **fecha_apertura** (por defecto hoy), **tipo_cdt**, **forma_pago**, **ciudad** (de diligenciamiento), oficina, fecha_dilig (por defecto hoy) |
| Personal | **nombre1**, nombre2, **apellido1**, apellido2, **tipo_doc**, **num_doc**, exp_fecha, exp_lugar, sexo, nac_fecha, nac_pais, nac_ciudad, nacionalidad (Colombiana), estado_civil, personas_cargo, nivel_educ, profesion, email, **celular**, tel_fijo, **direccion**, barrio, **ciudad_res**, depto_res, pais_res (Colombia), estrato, tipo_vivienda |
| Laboral | ocupacion, empresa, nit_empresa, cargo, contrato, fecha_ingreso, dir_trab, ciudad_trab, depto_trab, pais_trab (Colombia), tel_trab, ciiu, actividad_desc |
| Financiera | ingresos, otros_ingresos, desc_otros, egresos, activos, pasivos, declara_renta |
| Pago de intereses y cuenta | **periodicidad** (solo las habilitadas para entidad/plazo/valor, con su tasa), **cta_banco**, **cta_tipo**, **cta_numero** (solo dígitos), **cta_titular** |
| Resumen | sin claves: revisión y «Enviar a validación» |

Claves de perfil (se copian a `clientes.perfil` al enviar y precargan la siguiente solicitud):
todas las de Personal, Laboral, Financiera y las `cta_*`.

## 7. Fixture `tests/fixtures/cliente-ejemplo.json`

```json
{
  "congelado": {
    "valor": 50000000,
    "plazoDias": 180,
    "periodicidad": "vencimiento",
    "tasaEa": "10.5000",
    "fechaApertura": "2026-03-02",
    "fechaVenc": "2026-08-31"
  },
  "datos": {
    "tipo_cdt": "desmaterializado",
    "ciudad": "Medellín",
    "oficina": "Poblado",
    "fecha_dilig": "2026-03-02",
    "forma_pago": "transferencia",
    "nombre1": "María",
    "nombre2": "Fernanda",
    "apellido1": "Gómez",
    "apellido2": "Restrepo",
    "tipo_doc": "CC",
    "num_doc": "43123456",
    "exp_fecha": "2005-03-14",
    "exp_lugar": "Medellín",
    "sexo": "F",
    "nac_fecha": "1985-07-22",
    "nac_pais": "Colombia",
    "nac_ciudad": "Medellín",
    "nacionalidad": "Colombiana",
    "estado_civil": "soltero",
    "personas_cargo": "1",
    "nivel_educ": "universitario",
    "profesion": "Contadora",
    "email": "maria.gomez@ejemplo.com",
    "celular": "3001234567",
    "tel_fijo": "6041234567",
    "direccion": "Calle 10 # 40-25 Apto 301",
    "barrio": "El Poblado",
    "ciudad_res": "Medellín",
    "depto_res": "Antioquia",
    "pais_res": "Colombia",
    "estrato": "5",
    "tipo_vivienda": "propia",
    "ocupacion": "empleado",
    "empresa": "Industrias Ejemplo S.A.S.",
    "nit_empresa": "900123456",
    "cargo": "Gerente financiera",
    "contrato": "indefinido",
    "fecha_ingreso": "2016-02-01",
    "dir_trab": "Carrera 43A # 1-50 Of. 502",
    "ciudad_trab": "Medellín",
    "depto_trab": "Antioquia",
    "pais_trab": "Colombia",
    "tel_trab": "6045551234",
    "ciiu": "6920",
    "actividad_desc": "Actividades de contabilidad",
    "ingresos": "12000000",
    "otros_ingresos": "1500000",
    "desc_otros": "Arrendamiento de un local",
    "egresos": "6500000",
    "activos": "480000000",
    "pasivos": "120000000",
    "declara_renta": "si",
    "cta_banco": "Bancolombia",
    "cta_tipo": "ahorros",
    "cta_numero": "12345678901",
    "cta_titular": "María Fernanda Gómez Restrepo"
  }
}
```

(Datos ficticios del POC. `fechaVenc` es un valor congelado de entrada, no un cálculo que el
golden verifique.)

## 8. Consentimiento Ley 1581 — versión `2026-11-v1`

Texto base que muestra `/consentimiento` (revisión legal en la lista de lanzamiento; cambiar el
texto exige subir la versión, lo que vuelve a pedir el consentimiento a todos):

> Autorizo a Corban FC, como responsable del tratamiento, para recolectar, almacenar, usar y
> circular mis datos personales —incluidos datos de identificación, contacto, laborales y
> financieros— con la finalidad de gestionar mis solicitudes de apertura de CDT, diligenciar los
> formatos de las entidades financieras que yo elija, enviarlos a dichas entidades, hacer
> seguimiento a mis inversiones y contactarme sobre ellas, conforme a la Ley 1581 de 2012 y sus
> decretos reglamentarios. Conozco mis derechos a conocer, actualizar, rectificar y suprimir mis
> datos y a revocar esta autorización a través de los canales de atención publicados en
> corbanfc.com. Declaro que la información que suministro es veraz.

## 9. Límites de tasa (tabla `rate_limits`)

| Clave | Límite | Ventana | Respuesta |
|---|---|---|---|
| `otp:<correo>` (envío de OTP) | 5 | 15 min | 429 `LIMITE_EXCEDIDO` |
| `otp-ip:<ip>` (envío de OTP) | 20 | 15 min | 429 `LIMITE_EXCEDIDO` |
| `registro:<ip>` | 10 | 15 min | 429 `LIMITE_EXCEDIDO` |
| `firmados:<userId>` | 20 | 60 min | 429 `LIMITE_EXCEDIDO` |
| Verificación de OTP | 5 intentos por código | vida del código (10 min) | better-auth invalida el código |

## 10. Correos (plantillas HTML en español, `src/server/correo/plantillas.ts`)

| Plantilla | Para | Asunto |
|---|---|---|
| `otp` | quien pide el código | `Tu código de acceso a Corban CDT: <código>` |
| `invitacion` | cliente invitado | `<Nombre del asesor> te invita a abrir tu CDT con Corban FC` |
| `pendiente_validacion` | asesor asignado (o coordinadores si no hay) | `Solicitud <código> lista para validar` |
| `devuelta` | cliente | `Tu solicitud <código> necesita ajustes` |
| `pendiente_firma` | cliente | `Tus formatos de la solicitud <código> están listos para firmar` |
| `firma_en_revision` | asesor asignado | `El cliente subió la firma de <código>` |
| `cdt_constituido` | cliente | `Tu CDT <número> quedó constituido` |

Cada correo lleva el código de la solicitud y un enlace absoluto (`BETTER_AUTH_URL` +
ruta del detalle). Ningún correo incluye número de documento ni datos financieros.

## Evidencia de la prueba de los 6 PDF

La prueba de llenado de los 6 formatos (`docs/pruebas-pdf/`) corrió el 2026-11-05 con `fill.cjs`
y está descrita en `docs/pruebas-pdf/RESULTADO.md`. Sus límites (widgets duplicados de Mundo Mujer,
revisión visual pendiente de 4 formatos, sin snapshot golden todavía) se cierran en el paso 11.
