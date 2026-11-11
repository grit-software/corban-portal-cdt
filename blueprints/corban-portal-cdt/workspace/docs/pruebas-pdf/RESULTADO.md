# Prueba de llenado de los 6 PDF (2026-11-05)

Script: `fill.cjs` (Node + pdf-lib de la POC). Cliente ficticio de prueba (`JUAN CARLOS PEREZ GOMEZ`, 50.000.000 a 180 días, mensual, cuenta de ahorros Bancolombia).

| Formato | Filas del mapeo | Textos | Casillas | Campos no encontrados | Omitidos | Valores de fábrica sobrantes |
|---|---|---|---|---|---|---|
| ban_vinc | 80 | 43 | 4 | 0 | 0 | 0 |
| ban_orden | 69 | 41 | 9 | 0 | 0 | 0 |
| colte_vinc | 72 | 45 | 6 | 0 | 0 | 0 |
| colte_cdt | 26 | 22 | 1 | 0 | 0 | 0 |
| juris | 57 | 23 | 8 | 0 | 0 | 0 |
| mmujer | 82 | 45 | 7 | 0 | 0 | 0 |

Revisión visual (imágenes en `imagenes/`): **ban_orden** y **colte_cdt** revisados a ojo; datos en su casilla.

## Límites de esta prueba
- No aplica la **depuración de widgets duplicados** de la POC (`dedupeWidgets`). Mundo Mujer es el formato que la necesita; el texto doble no está probado aquí.
- Solo 2 de 6 PDF revisados visualmente. Faltan `ban_vinc`, `colte_vinc`, `juris` y `mmujer`.
- No se verifica el campo por campo contra un resultado esperado (el snapshot golden aún no existe).
