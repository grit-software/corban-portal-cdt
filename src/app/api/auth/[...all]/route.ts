import { getAuth } from "@/server/auth/auth";
import { revisarEnvioOtp } from "@/server/auth/otp-entrada";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export async function POST(request: Request): Promise<Response> {
  const bloqueo = await revisarEnvioOtp(request);
  if (bloqueo) {
    return bloqueo;
  }
  return getAuth().handler(request);
}
