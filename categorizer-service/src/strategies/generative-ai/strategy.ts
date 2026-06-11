import type { CategoryDTO } from "@move/shared";
import { buildOllamaHttpError, fetchOllamaResponse, resolveOllamaModel } from "../ollama";
import type { StrategyDiagnostics } from "../types";

const MODEL = process.env["OLLAMA_MODEL"] ?? "llama3.2:1b";
const MODEL_FALLBACKS = [
  "llama3.2:1b:latest",
  "llama3.2:1b",
  "llama3.2",
  "llama3.2:latest",
  "llama3:latest",
] as const;

export interface GenerativeAiInput {
  description: string;
  availableCategories: CategoryDTO[];
}

// Uses local Ollama model to classify a reservation description into a category
export async function classifyWithGenerativeAi(input: GenerativeAiInput): Promise<string | null> {
  const result = await diagnoseGenerativeAiClassification(input);
  return result.categoryId;
}

export async function diagnoseGenerativeAiClassification(
  input: GenerativeAiInput
): Promise<StrategyDiagnostics> {
  const model = await resolveOllamaModel(MODEL, MODEL_FALLBACKS);
  const categoryContext = input.availableCategories
    .map((category) => {
      const examples =
        category.descriptions.length > 0 ? ` Examples: ${category.descriptions.join("; ")}` : "";
      return `- ${category.name}.${examples}`;
    })
    .join("\n");
  const prompt = `Given the following categories:\n${categoryContext}\nClassify this request: "${input.description}"\nRespond with only the category name.`;

  try {
    const res = await fetchOllamaResponse("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!res.ok) {
      return {
        categoryId: null,
        error: await buildOllamaHttpError(res),
      };
    }

    const body = (await res.json()) as { response: string };
    const rawLabel = body.response.trim();
    const match = input.availableCategories.find(
      (c) => c.name.toLowerCase() === rawLabel.toLowerCase()
    );

    return {
      categoryId: match?.id ?? null,
      rawLabel,
    };
  } catch (error) {
    return {
      categoryId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
