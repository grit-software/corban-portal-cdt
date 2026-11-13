import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Cliente de better-auth para los componentes del navegador. No importa nada del servidor.
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
