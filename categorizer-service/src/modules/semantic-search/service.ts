import type { CategoryDTO } from "@move/shared";
import { loadActiveCategories } from "../../categories";
import { getEmbeddingsPort } from "./runtime";

const MIN_SEMANTIC_SCORE = 0.52;
const MIN_SEMANTIC_MARGIN = 0.012;

interface CachedCategoryEmbedding {
  category: CategoryDTO;
  vector: number[];
}

interface ScoredCategory {
  id: string;
  name: string;
  score: number;
}

let warmupPromise: Promise<void> | null = null;
let cacheStatus: "idle" | "warming" | "ready" | "failed" = "idle";
let categoryEmbeddingCache: CachedCategoryEmbedding[] = [];
let lastWarmupError: Error | null = null;

export async function warmSemanticSearchCache(): Promise<void> {
  if (warmupPromise) {
    return warmupPromise;
  }

  cacheStatus = "warming";
  warmupPromise = (async () => {
    try {
      const categories = await loadActiveCategories();
      if (categories.length === 0) {
        throw new Error("No active categories available");
      }

      const embeddingsPort = getEmbeddingsPort();
      const cachedEmbeddings: CachedCategoryEmbedding[] = [];

      for (const category of categories) {
        const vector = await embeddingsPort.embed(buildCategoryText(category));
        cachedEmbeddings.push({ category, vector });
      }

      categoryEmbeddingCache = cachedEmbeddings;
      cacheStatus = "ready";
      lastWarmupError = null;
    } catch (error) {
      cacheStatus = "failed";
      lastWarmupError = error instanceof Error ? error : new Error(String(error));
      throw lastWarmupError;
    }
  })();

  try {
    await warmupPromise;
  } finally {
    warmupPromise = null;
  }
}

export async function classifyDescription(description: string): Promise<string | null> {
  if (cacheStatus !== "ready" || categoryEmbeddingCache.length === 0) {
    throw buildUnavailableCacheError();
  }

  const queryEmbedding = await getEmbeddingsPort().embed(buildQueryText(description));
  const scored = categoryEmbeddingCache
    .map((entry) => ({
      id: entry.category.id,
      name: entry.category.name,
      score: cosineSimilarity(queryEmbedding, entry.vector),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const secondBest = scored[1];
  const scoreMargin = best && secondBest ? best.score - secondBest.score : (best?.score ?? 0);
  const accepted = Boolean(best && hasConfidentSemanticMatch(best.score, scoreMargin));

  logSemanticDecision({
    description,
    accepted,
    best,
    secondBest,
    scoreMargin,
    topCandidates: scored.slice(0, 3),
  });

  return accepted && best ? best.id : null;
}

export function getSemanticSearchCacheStatus(): {
  status: "idle" | "warming" | "ready" | "failed";
  categoryCount: number;
  lastError: string | null;
} {
  return {
    status: cacheStatus,
    categoryCount: categoryEmbeddingCache.length,
    lastError: lastWarmupError?.message ?? null,
  };
}

function buildUnavailableCacheError(): Error {
  if (cacheStatus === "warming") {
    return new Error("Semantic search cache is still warming");
  }

  if (cacheStatus === "failed" && lastWarmupError) {
    return new Error(`Semantic search cache is unavailable: ${lastWarmupError.message}`);
  }

  return new Error("Semantic search cache is unavailable");
}

function logSemanticDecision(input: {
  description: string;
  accepted: boolean;
  best: ScoredCategory | undefined;
  secondBest: ScoredCategory | undefined;
  scoreMargin: number;
  topCandidates: ScoredCategory[];
}): void {
  if (!isSemanticSearchDebugEnabled()) {
    return;
  }

  console.info(
    JSON.stringify({
      event: "semantic-search-decision",
      accepted: input.accepted,
      description: input.description,
      thresholds: {
        minScore: MIN_SEMANTIC_SCORE,
        minMargin: MIN_SEMANTIC_MARGIN,
      },
      best: input.best
        ? {
            id: input.best.id,
            name: input.best.name,
            score: roundScore(input.best.score),
          }
        : null,
      secondBest: input.secondBest
        ? {
            id: input.secondBest.id,
            name: input.secondBest.name,
            score: roundScore(input.secondBest.score),
          }
        : null,
      scoreMargin: roundScore(input.scoreMargin),
      topCandidates: input.topCandidates.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        score: roundScore(candidate.score),
      })),
    })
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, index) => sum + val * (b[index] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (magA * magB);
}

function hasConfidentSemanticMatch(bestScore: number, scoreMargin: number): boolean {
  return bestScore >= MIN_SEMANTIC_SCORE && scoreMargin >= MIN_SEMANTIC_MARGIN;
}

function isSemanticSearchDebugEnabled(): boolean {
  const value = process.env["SEMANTIC_SEARCH_DEBUG"]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function buildQueryText(description: string): string {
  return `query: ${description.trim()}`;
}

function buildCategoryText(category: CategoryDTO): string {
  const examples = category.descriptions
    .map((description) => description.trim())
    .filter((description) => description.length > 0)
    .join("\n");

  const categoryText = [category.spanishName.trim(), category.name.trim(), examples]
    .filter((segment) => segment.trim().length > 0)
    .join("\n");

  return `passage: ${categoryText}`;
}
