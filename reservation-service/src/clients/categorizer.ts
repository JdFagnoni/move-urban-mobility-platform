const CATEGORIZER_URL = process.env["CATEGORIZER_SERVICE_URL"] ?? "http://localhost:3003";
const CATEGORIZER_TIMEOUT_MS = 10_000;

interface CategorizeResponse {
  success: boolean;
  data?: { categoryId: string };
}

// categorizer-service devuelve 422 cuando la clasificacion corrio
// correctamente pero no encontro una categoria con suficiente confianza
// (router.ts: "Could not classify request") -- es un resultado de negocio
// determinístico, no un error, asi que se devuelve null sin reintentar.
// Cualquier otro fallo (503 por cache no disponible, timeout, error de red)
// se lanza para que el consumer que clasifica reservas individuales pueda
// reintentar.
const UNCLASSIFIED_STATUS = 422;

export async function classifyGood(description: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATEGORIZER_TIMEOUT_MS);

  try {
    const response = await fetch(`${CATEGORIZER_URL}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
      signal: controller.signal,
    });

    if (response.status === UNCLASSIFIED_STATUS) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`categorizer-service responded with ${response.status}`);
    }

    const body = (await response.json()) as CategorizeResponse;
    return body.data?.categoryId ?? null;
  } finally {
    clearTimeout(timer);
  }
}
