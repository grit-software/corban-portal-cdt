---
name: regenerar-golden
description: Regenera los snapshots golden de los PDF cuando un cambio INTENCIONAL del mapeo, de derivarDatosPdf o del fixture cambia valores esperados. Úsala cuando la prueba pdf-golden falle después de editar mapping.json, el motor PDF o cliente-ejemplo.json a propósito.
---

# Regenerar los snapshots golden de los PDF

## Cuándo usarla
- Cambiaste a propósito una fila de `assets/formatos/mapping*.json`, `src/server/pdf/derivar.ts`
  o `tests/fixtures/cliente-ejemplo.json`, y `pnpm test tests/unit/pdf-golden.test.ts` falla solo en
  los campos que esperabas cambiar.
- **No** la uses si falló un documento que no tocaste: eso es una regresión, corrígela.

## Pasos
1. Corre la prueba y lee el diff: cada campo que cambia debe estar explicado por tu cambio.
2. Borra solo los snapshots afectados: `tests/unit/__snapshots__/pdf-<docKey>.json`.
3. Corre la prueba sin la variable `CI` (Vitest no escribe snapshots nuevos en CI) para que se
   escriban de nuevo, y una segunda vez para confirmar que comparan.
4. Abre el PDF generado de cada documento afectado y revísalo visualmente.
5. Commitea los snapshots junto con el cambio que los motivó, explicando el porqué en el mensaje.

## Verify
```bash
pnpm test tests/unit/pdf-golden.test.ts   # expect: exit 0 (escribe)
pnpm test tests/unit/pdf-golden.test.ts   # expect: exit 0 (compara)
git diff --stat tests/unit/__snapshots__  # expect: solo los docKey que cambiaste
```

## No hagas
- No uses `vitest -u` sobre toda la suite: actualizaría snapshots que no revisaste.
- No regeneres para silenciar un `notFound` no vacío: ese campo no existe en el PDF y el mapeo está mal.
