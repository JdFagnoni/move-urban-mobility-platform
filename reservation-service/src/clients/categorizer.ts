const CATEGORIZER_URL = process.env["CATEGORIZER_SERVICE_URL"] ?? "http://localhost:3003";
const CATEGORIZER_TIMEOUT_MS = 10_000;

interface CategorizeResponse {
  success: boolean;
  data?: { categoryId: string };
}

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

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as CategorizeResponse;
    return body.data?.categoryId ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
