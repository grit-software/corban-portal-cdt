import { BlobSASPermissions, BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import type { StorageDriver } from "./tipos.ts";

// Driver Azure Blob (producción). Contenedor privado. Las descargas van por una SAS de lectura
// de 300 s. Este driver no se ejecuta en pruebas locales: no hay cuenta de Azure en el entorno.
export function crearStorageAzure(opciones: {
  connectionString?: string;
  cuenta?: string;
  contenedor: string;
}): StorageDriver {
  const servicio = opciones.connectionString
    ? BlobServiceClient.fromConnectionString(opciones.connectionString)
    : new BlobServiceClient(
        `https://${opciones.cuenta}.blob.core.windows.net`,
        new DefaultAzureCredential(),
      );
  const contenedor: ContainerClient = servicio.getContainerClient(opciones.contenedor);

  return {
    async put(clave, bytes) {
      await contenedor.getBlockBlobClient(clave).uploadData(bytes, {
        blobHTTPHeaders: { blobContentType: "application/pdf" },
      });
    },
    async get(clave) {
      const respuesta = await contenedor.getBlockBlobClient(clave).download();
      const cuerpo = await respuesta.blobBody;
      if (!cuerpo) {
        throw new Error("El documento no existe en el almacenamiento");
      }
      return new Uint8Array(await cuerpo.arrayBuffer());
    },
    async delete(clave) {
      await contenedor.getBlockBlobClient(clave).deleteIfExists();
    },
    async signedUrl(clave) {
      const blob = contenedor.getBlockBlobClient(clave);
      const expira = new Date(Date.now() + 300_000);
      if (opciones.connectionString) {
        return blob.generateSasUrl({
          permissions: BlobSASPermissions.parse("r"),
          expiresOn: expira,
        });
      }
      // Con identidad administrada la SAS sale de una clave de delegación de usuario.
      const clave2 = await servicio.getUserDelegationKey(new Date(Date.now() - 60_000), expira);
      const { generateBlobSASQueryParameters } = await import("@azure/storage-blob");
      const firma = generateBlobSASQueryParameters(
        {
          containerName: opciones.contenedor,
          blobName: clave,
          permissions: BlobSASPermissions.parse("r"),
          expiresOn: expira,
        },
        clave2,
        opciones.cuenta ?? "",
      ).toString();
      return `${blob.url}?${firma}`;
    },
  };
}
