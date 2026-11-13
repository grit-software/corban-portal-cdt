import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./tipos.ts";

// Driver local: escribe bajo STORAGE_FS_ROOT. Rechaza claves que salen de la raíz (..) y nunca
// escribe bajo public/ (CLAUDE.md: los archivos no van a public).
export function crearStorageFs(raiz: string): StorageDriver {
  const base = path.resolve(raiz);

  function rutaSegura(clave: string): string {
    if (clave.split(/[\\/]/).includes("..") || path.isAbsolute(clave)) {
      throw new Error("Clave de almacenamiento no válida");
    }
    const destino = path.resolve(base, clave);
    if (!destino.startsWith(base + path.sep)) {
      throw new Error("Clave de almacenamiento fuera de la raíz");
    }
    return destino;
  }

  return {
    async put(clave, bytes) {
      const destino = rutaSegura(clave);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, bytes);
    },
    async get(clave) {
      return new Uint8Array(await readFile(rutaSegura(clave)));
    },
    async delete(clave) {
      await rm(rutaSegura(clave), { force: true });
    },
    async signedUrl() {
      // Sin URL firmada: el handler entrega los bytes con content-disposition attachment.
      return null;
    },
  };
}
