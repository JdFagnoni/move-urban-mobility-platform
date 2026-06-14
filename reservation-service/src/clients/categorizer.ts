const CATEGORIZER_URL = process.env["CATEGORIZER_SERVICE_URL"] ?? "http://localhost:3003";

interface CategorizeResponse {
  success: boolean;
  data?: { categoryId: string };
}

export async function classifyGood(description: string): Promise<string | null> {
  try {
    const response = await fetch(`${CATEGORIZER_URL}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as CategorizeResponse;
    return body.data?.categoryId ?? null;
  } catch {
    return null;
  }
}
