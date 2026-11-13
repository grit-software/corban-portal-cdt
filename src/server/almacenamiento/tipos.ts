// Contrato del almacenamiento de documentos. Dos drivers: fs (local, pruebas y desarrollo) y
// azure (producción). Las claves son rutas lógicas: solicitudes/<id>/v<version>/<archivo>.

export type StorageDriver = {
  put(clave: string, bytes: Uint8Array): Promise<void>;
  get(clave: string): Promise<Uint8Array>;
  delete(clave: string): Promise<void>;
  // URL firmada de lectura, o null si el handler debe entregar los bytes.
  signedUrl(clave: string): Promise<string | null>;
};
