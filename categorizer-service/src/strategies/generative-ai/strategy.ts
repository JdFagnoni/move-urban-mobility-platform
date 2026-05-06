import type { CategoryDTO } from "@move/shared";

const OLLAMA_URL = process.env["OLLAMA_URL"] ?? "http://localhost:11434";
const MODEL = process.env["OLLAMA_MODEL"] ?? "llama3";

export interface GenerativeAiInput {
  description: string;
  availableCategories: CategoryDTO[];
}

// Uses local Ollama model to classify a reservation description into a category
export async function classifyWithGenerativeAi(
  input: GenerativeAiInput
): Promise<string | null> {
  const categoryNames = input.availableCategories.map((c) => c.name).join(", ");
  const prompt = `Given the following categories: ${categoryNames}\nClassify this request: "${input.description}"\nRespond with only the category name.`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { response: string };
    const match = input.availableCategories.find(
      (c) => c.name.toLowerCase() === body.response.trim().toLowerCase()
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}
