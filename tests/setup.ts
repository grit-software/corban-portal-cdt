import { existsSync } from "node:fs";

// setupFiles de Vitest. Vitest no carga .env en process.env: se carga aquí.
// Las pruebas NUNCA usan la base de desarrollo: DATABASE_URL pasa a ser TEST_DATABASE_URL.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.STORAGE_DRIVER = "fs";
process.env.STORAGE_FS_ROOT = ".data/test-storage";
process.env.MAIL_DRIVER = "file";
process.env.MAIL_FILE_DIR = ".data/test-mail";
process.env.AUTH_TEST_LOGIN = "1";
