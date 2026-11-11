---
name: agregar-entidad
description: Agrega una quinta (o siguiente) entidad financiera con sus formatos PDF. Úsala cuando pidan "agregar una entidad", "nuevo banco", "nueva cooperativa", "otro formato de CDT" o "mapear un PDF nuevo".
---

# Agregar una entidad financiera

## Cuándo usarla
- Corban firma con una entidad nueva y entrega su(s) PDF AcroForm de vinculación / CDT.
- Una entidad existente cambia su formato oficial (mismo procedimiento con el `docKey` existente).

## Pasos
1. Copia cada PDF a `assets/formatos/<docKey>.pdf` (`docKey` en minúsculas y `_`, p. ej. `bancox_vinc`).
   Verifica que sea un AcroForm: con la skill `pdf` o un script que liste `form.getFields()` de pdf-lib.
2. Añade las filas de mapeo en `assets/formatos/mapping.json` bajo la clave `<docKey>`
   (tipos `t`, `d`, `c`, `x`, `s`, `tv`, `ch`; contrato en `docs/referencia/contratos.md` §5). Si el
   formato tiene cuenta de pago de intereses, sus filas van en `mapping.cuenta-pago.json`.
   Usa solo claves de datos que existen (§5 y §6 de `contratos.md`).
3. Añade el prefijo de nombre de archivo en `src/server/pdf/nombres.ts`.
4. Añade la entidad a `ENTIDADES_BASE` en `src/server/db/seed-base.ts` (`id`, `nombre`, `docKeys`,
   `plazoEnMeses`) y añade el `docKey` a la lista de documentos de `tests/unit/pdf-golden.test.ts`.
5. Ejecuta la prueba golden: crea `tests/unit/__snapshots__/pdf-<docKey>.json` en la primera corrida
   (local, sin `CI`). Abre el PDF generado y revísalo visualmente contra el formato de la entidad.
6. `pnpm db:seed` en cada entorno (es idempotente) y pide al coordinador cargar las condiciones de tasa.

## Verify
```bash
pnpm test tests/unit/pdf-golden.test.ts   # expect: exit 0 y notFound vacío para el docKey nuevo
pnpm test tests/unit/pdf-golden.test.ts   # expect: exit 0 — segunda corrida compara contra el snapshot
pnpm typecheck && pnpm lint               # expect: exit 0
```

## No hagas
- No edites los snapshots golden a mano ni los regeneres para "hacer pasar" la prueba de otro docKey.
- No inventes condiciones de tasa ni montos mínimos: los carga el coordinador en `/coordinador/condiciones`.
- No dupliques lógica del motor por entidad: las diferencias viven en `base_calculo`, `ajuste_no_habil` y el mapeo.
