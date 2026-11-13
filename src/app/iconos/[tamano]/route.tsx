import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const dynamic = "force-dynamic";

// Ícono de la PWA: cuadrado navy con el logo centrado al 60 % del ancho. Solo 192 o 512 px.
// Los estilos en línea son obligatorios aquí: ImageResponse no usa clases de Tailwind.
export async function GET(
  _request: Request,
  context: { params: Promise<{ tamano: string }> },
): Promise<Response> {
  const { tamano } = await context.params;
  const medida = Number(tamano);
  if (medida !== 192 && medida !== 512) {
    return new Response("No encontrado", { status: 404 });
  }
  const logo = await readFile(path.join(process.cwd(), "public", "logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  const lado = Math.round(medida * 0.6);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#1D2226",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse exige <img> nativo */}
      <img src={src} width={lado} height={lado} alt="" />
    </div>,
    { width: medida, height: medida },
  );
}
