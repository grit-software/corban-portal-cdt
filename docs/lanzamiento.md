# Lanzamiento de Corban CDT

Este documento reúne lo que debe cumplirse antes de abrir el portal a clientes reales, el
procedimiento de release y el aprovisionamiento de Azure.

## Lista de verificación de lanzamiento

- [ ] Revisión visual de los 6 PDF de formatos por un asesor senior.
- [ ] Ingreso real con Entra de un miembro del staff, y rechazo de un correo no registrado.
- [ ] Driver `azure` real: documentos con SAS de 5 minutos, y contenedor sin acceso anónimo.
- [ ] Correo real por ACS, sin spam (remitente, SPF y DKIM verificados).
- [ ] Revisión legal del consentimiento `2026-11-v1`, la retención de datos y la transferencia
  internacional.
- [ ] Application Insights recibe un error de prueba, y existe una alerta sobre `/api/health/db`.
- [ ] Migraciones con `pnpm db:migrate` como paso de release.
- [ ] `pnpm db:seed` con el administrador real, y condiciones reales cargadas (sin tasas DEMO).
- [ ] Rollback practicado en un entorno de prueba.
- [ ] Pasadas de teclado, lector de pantalla y zoom sobre las páginas principales.
- [ ] `AUTH_TEST_LOGIN=0` en la configuración de producción.

## Procedimiento de release

1. Construir la imagen con la etiqueta del commit, y publicarla en el registro de contenedores.
2. Migrar la base de datos con `pnpm db:migrate`, apuntando a la base de producción.
3. Cambiar la imagen de la aplicación con `az webapp config container set`.
4. Verificar `/api/health/db`.
5. Si algo falla, hacer rollback a la etiqueta anterior con el mismo comando de cambio de imagen.

## Aprovisionamiento

Verificar las opciones de cada comando con `az <comando> --help` antes de ejecutarlo.

```bash
export GRUPO=rg-corban-cdt UBICACION=eastus2
export PG=psql-corban-cdt ST=stcorbancdt ACS=acs-corban-cdt PLAN=asp-corban-cdt APP=app-corban-cdt
export IMAGEN="ghcr.io/corbanfc/corban-cdt:$(git rev-parse --short HEAD)"   # ajustar a la organización real de GitHub
az group create --name "$GRUPO" --location "$UBICACION"
az postgres flexible-server create --resource-group "$GRUPO" --name "$PG" --location "$UBICACION" \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 17 \
  --admin-user corbanadmin --admin-password "$PG_ADMIN_PASSWORD" --public-access 0.0.0.0
az postgres flexible-server db create --resource-group "$GRUPO" --server-name "$PG" --database-name corban
az storage account create --name "$ST" --resource-group "$GRUPO" --location "$UBICACION" \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --account-name "$ST" --name documentos --auth-mode login
az communication create --name "$ACS" --resource-group "$GRUPO" --location global --data-location UnitedStates
az appservice plan create --name "$PLAN" --resource-group "$GRUPO" --is-linux --sku B1
az webapp create --name "$APP" --resource-group "$GRUPO" --plan "$PLAN" --container-image-name "$IMAGEN"
az webapp identity assign --name "$APP" --resource-group "$GRUPO"
az role assignment create \
  --assignee "$(az webapp identity show --name "$APP" --resource-group "$GRUPO" --query principalId -o tsv)" \
  --role "Storage Blob Data Contributor" \
  --scope "$(az storage account show --name "$ST" --resource-group "$GRUPO" --query id -o tsv)"
az webapp config appsettings set --name "$APP" --resource-group "$GRUPO" --settings \
  NODE_ENV=production WEBSITES_PORT=3000 AUTH_TEST_LOGIN=0 \
  BETTER_AUTH_URL="https://$APP.azurewebsites.net" \
  STORAGE_DRIVER=azure AZURE_STORAGE_ACCOUNT="$ST" AZURE_STORAGE_CONTAINER=documentos \
  MAIL_DRIVER=acs MAIL_FROM="$MAIL_FROM" ADMIN_EMAIL="$ADMIN_EMAIL" \
  DATABASE_URL="$DATABASE_URL" BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  ACS_CONNECTION_STRING="$ACS_CONNECTION_STRING" \
  ENTRA_CLIENT_ID="$ENTRA_CLIENT_ID" ENTRA_CLIENT_SECRET="$ENTRA_CLIENT_SECRET" ENTRA_TENANT_ID="$ENTRA_TENANT_ID"
az webapp config set --name "$APP" --resource-group "$GRUPO" --generic-configurations '{"healthCheckPath": "/api/health/db"}'
az ad app create --display-name "Corban CDT" --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://$APP.azurewebsites.net/api/auth/callback/microsoft"
```
