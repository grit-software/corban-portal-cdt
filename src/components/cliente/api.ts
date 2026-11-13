// Llamadas a /api/v1 desde el navegador. Devuelven siempre la misma forma (contratos.md §1).

export type ErrorApi = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

export type ResultadoApi<T> = { ok: true; data: T } | { ok: false; error: ErrorApi };

export async function llamarApi<T>(
  metodo: "GET" | "POST" | "PATCH",
  url: string,
  cuerpo?: unknown,
): Promise<ResultadoApi<T>> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { "content-type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    return { ok: false, error: { code: "RED", message: "Sin conexión. Intenta de nuevo." } };
  }
  const cuerpoJson = (await respuesta.json().catch(() => null)) as {
    data?: T;
    error?: ErrorApi;
  } | null;
  if (respuesta.ok && cuerpoJson && "data" in cuerpoJson) {
    return { ok: true, data: cuerpoJson.data as T };
  }
  return {
    ok: false,
    error: cuerpoJson?.error ?? {
      code: "ERROR_INTERNO",
      message: "Ocurrió un error. Intenta de nuevo.",
    },
  };
}
