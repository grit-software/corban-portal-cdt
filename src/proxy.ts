import { type NextRequest, NextResponse } from "next/server";

// Protección de páginas: sin cookie de sesión, el área de cliente va a /ingreso y el área de
// staff a /ingreso-staff. La validación real de la sesión la hace getActor() en cada página.
const COOKIES_SESION = ["better-auth.session_token", "__Secure-better-auth.session_token"];
const RUTAS_CLIENTE = ["/mi-cuenta"];
const RUTAS_STAFF = ["/asesor", "/coordinador", "/gerencia", "/admin"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const conSesion = COOKIES_SESION.some((nombre) => request.cookies.has(nombre));
  if (conSesion) {
    return NextResponse.next();
  }
  if (RUTAS_CLIENTE.some((ruta) => pathname.startsWith(ruta))) {
    const destino = new URL("/ingreso", request.url);
    destino.searchParams.set("siguiente", `${pathname}${search}`);
    return NextResponse.redirect(destino);
  }
  if (RUTAS_STAFF.some((ruta) => pathname.startsWith(ruta))) {
    return NextResponse.redirect(new URL("/ingreso-staff", request.url));
  }
  return NextResponse.next();
}

// Solo páginas: nunca /api.
export const config = {
  matcher: [
    "/mi-cuenta/:path*",
    "/asesor/:path*",
    "/coordinador/:path*",
    "/gerencia/:path*",
    "/admin/:path*",
  ],
};
