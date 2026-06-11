import type { CategoryDTO } from "@move/shared";
import { buildOllamaHttpError, fetchOllamaResponse, resolveOllamaModel } from "../ollama";
import type { StrategyDiagnostics } from "../types";

export interface SemanticSearchInput {
  description: string;
  availableCategories: CategoryDTO[];
}

const embeddingCache = new Map<string, Promise<number[]>>();
const MIN_SEMANTIC_SCORE = 0.52;
const MIN_SEMANTIC_MARGIN = 0.01;
const MIN_LEXICAL_OVERLAP = 2;
const LEXICAL_STOP_WORDS = new Set([
  "para",
  "con",
  "por",
  "las",
  "los",
  "una",
  "uno",
  "unos",
  "unas",
  "que",
  "del",
  "hay",
  "quiero",
  "necesito",
  "enviar",
  "mover",
  "traslado",
  "llevar",
  "equipo",
  "articulos",
  "artículos",
]);

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
  const MODEL = process.env["OLLAMA_EMBED_MODEL"] ?? "paraphrase-multilingual-minilm-l12-v2";
  const resolvedModel = await resolveOllamaModel(MODEL, [
    "paraphrase-multilingual-minilm-l12-v2",
    "paraphrase-multilingual-minilm-l12-v2:latest",
    "bge-m3",
    "bge-m3:latest",
    "nomic-embed-text:latest",
    "nomic-embed-text",
    "mxbai-embed-large",
    "mxbai-embed-large:latest",
  ]);
  const cacheKey = `${resolvedModel}:${text}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const embeddingPromise = (async () => {
    const res = await fetchOllamaResponse("/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: resolvedModel, input: text }),
    });

    if (!res.ok) {
      throw new Error(await buildOllamaHttpError(res));
    }

    const body = (await res.json()) as { embeddings?: number[][] };
    const embedding = body.embeddings?.[0];
    if (!embedding) {
      throw new Error("Embedding response did not include embeddings[0]");
    }

    return embedding;
  })();

  embeddingCache.set(cacheKey, embeddingPromise);

  try {
    return await embeddingPromise;
  } catch (error) {
    embeddingCache.delete(cacheKey);
    throw error;
  }
}

// R10 – classify via semantic similarity of embeddings
export async function classifyWithSemanticSearch(
  input: SemanticSearchInput
): Promise<string | null> {
  const result = await diagnoseSemanticSearchClassification(input);
  return result.categoryId;
}

export async function diagnoseSemanticSearchClassification(
  input: SemanticSearchInput
): Promise<StrategyDiagnostics> {
  try {
    const queryEmbedding = await embed(buildQueryText(input.description));
    const scored = await Promise.all(
      input.availableCategories.map(async (cat) => {
        const catEmbedding = await embed(buildCategoryText(cat));
        return { id: cat.id, score: cosineSimilarity(queryEmbedding, catEmbedding) };
      })
    );

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const secondBest = scored[1];
    const scoreMargin = best && secondBest ? best.score - secondBest.score : best?.score ?? 0;
    const bestCategory = best
      ? input.availableCategories.find((category) => category.id === best.id) ?? null
      : null;
    const lexicalOverlap = bestCategory
      ? countLexicalOverlap(input.description, bestCategory)
      : 0;
    const shouldClassify =
      !!best &&
      best.score >= MIN_SEMANTIC_SCORE &&
      scoreMargin >= MIN_SEMANTIC_MARGIN &&
      lexicalOverlap >= MIN_LEXICAL_OVERLAP;

    return best
      ? {
          categoryId: shouldClassify ? best.id : null,
          rawLabel: `score=${best.score.toFixed(4)} margin=${scoreMargin.toFixed(4)} overlap=${lexicalOverlap}`,
        }
      : { categoryId: null };
  } catch (error) {
    return {
      categoryId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildQueryText(description: string): string {
  return `Reservation item description in Spanish:\n${description.trim()}`;
}

function buildCategoryText(category: CategoryDTO): string {
  const examples = category.descriptions
    .map((description) => description.trim())
    .filter((description) => description.length > 0)
    .join("\n");

  return [`MOVE category in Spanish: ${category.name}`, "Representative examples:", examples]
    .filter((segment) => segment.trim().length > 0)
    .join("\n");
}

function countLexicalOverlap(description: string, category: CategoryDTO): number {
  const descriptionTokens = tokenize(description);
  const categoryTokens = tokenize([category.name, ...category.descriptions].join(" "));
  let overlap = 0;

  for (const token of descriptionTokens) {
    if (categoryTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function tokenize(input: string): Set<string> {
  return new Set(
    normalizeText(input)
      .split(" ")
      .filter((token) => token.length >= 4 && !LEXICAL_STOP_WORDS.has(token))
  );
}

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}
