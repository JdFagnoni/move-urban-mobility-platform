import type { CategoryDTO } from "@move/shared";

export interface SemanticSearchInput {
  description: string;
  availableCategories: CategoryDTO[];
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Embed text using Ollama embeddings endpoint
async function embed(text: string): Promise<number[]> {
  const OLLAMA_URL = process.env["OLLAMA_URL"] ?? "http://localhost:11434";
  const MODEL = process.env["OLLAMA_EMBED_MODEL"] ?? "nomic-embed-text";

  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error("Embedding request failed");
  const body = (await res.json()) as { embedding: number[] };
  return body.embedding;
}

// R10 – classify via semantic similarity of embeddings
export async function classifyWithSemanticSearch(
  input: SemanticSearchInput
): Promise<string | null> {
  const queryEmbedding = await embed(input.description);
  const scored = await Promise.all(
    input.availableCategories.map(async (cat) => {
      const catEmbedding = await embed([cat.name, ...cat.descriptions].join("\n"));
      return { id: cat.id, score: cosineSimilarity(queryEmbedding, catEmbedding) };
    })
  );

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && best.score > 0.6 ? best.id : null;
}
