import { getEnv } from "@/lib/env";
import { crearStorageAzure } from "./azure.ts";
import { crearStorageFs } from "./fs.ts";
import type { StorageDriver } from "./tipos.ts";

// Único punto de acceso al almacenamiento. Elige el driver por STORAGE_DRIVER.
let instancia: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  if (!instancia) {
    const env = getEnv();
    instancia =
      env.STORAGE_DRIVER === "azure"
        ? crearStorageAzure({
            connectionString: env.AZURE_STORAGE_CONNECTION_STRING,
            cuenta: env.AZURE_STORAGE_ACCOUNT,
            contenedor: env.AZURE_STORAGE_CONTAINER,
          })
        : crearStorageFs(env.STORAGE_FS_ROOT);
  }
  return instancia;
}

export function reiniciarStorageParaPruebas(): void {
  instancia = undefined;
}
