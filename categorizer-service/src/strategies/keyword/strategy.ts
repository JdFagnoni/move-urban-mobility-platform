import type { CategoryDTO } from "@move/shared";
import type { StrategyDiagnostics } from "../types";

export interface KeywordInput {
  description: string;
  availableCategories: CategoryDTO[];
}

const STOP_WORDS = new Set([
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
  "necesito",
  "quiero",
  "llevar",
  "lleven",
  "envio",
  "productos",
  "producto",
  "accesorios",
  "accesorio",
  "insumos",
  "suministros",
  "general",
  "generales",
  "and",
  "for",
  "with",
]);

// R10 – fallback keyword-match strategy
export function classifyWithKeyword(input: KeywordInput): string | null {
  return diagnoseKeywordClassification(input).categoryId;
}

export function diagnoseKeywordClassification(input: KeywordInput): StrategyDiagnostics {
  const normalizedDescription = normalizeText(input.description);
  const descriptionTokens = tokenize(input.description);
  let bestMatch: { categoryId: string; label: string; score: number } | null = null;
  let secondBestScore = 0;

  for (const category of input.availableCategories) {
    const score = scoreCategory(category, normalizedDescription, descriptionTokens);

    if (!bestMatch || score > bestMatch.score) {
      secondBestScore = bestMatch?.score ?? 0;
      bestMatch = {
        categoryId: category.id,
        label: category.name,
        score,
      };
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  if (!bestMatch) {
    return { categoryId: null };
  }

  const scoreMargin = bestMatch.score - secondBestScore;
  const shouldClassify = bestMatch.score >= 4 && scoreMargin >= 1;

  return {
    categoryId: shouldClassify ? bestMatch.categoryId : null,
    rawLabel: `${bestMatch.label} score=${bestMatch.score.toFixed(2)} margin=${scoreMargin.toFixed(2)}`,
  };
}

function scoreCategory(
  category: CategoryDTO,
  normalizedDescription: string,
  descriptionTokens: Set<string>
): number {
  const normalizedName = normalizeText(category.name);
  const nameTokens = tokenize(category.name);
  const descriptionTokensByCategory = tokenize(category.descriptions.join(" "));

  let score = 0;

  if (normalizedName && normalizedDescription.includes(normalizedName)) {
    score += 6;
  }

  for (const description of category.descriptions) {
    const normalizedCategoryDescription = normalizeText(description);
    if (normalizedCategoryDescription && normalizedDescription.includes(normalizedCategoryDescription)) {
      score += 4;
      break;
    }
  }

  score += overlapScore(descriptionTokens, nameTokens, 2.5);
  score += overlapScore(descriptionTokens, descriptionTokensByCategory, 1);

  return score;
}

function overlapScore(
  queryTokens: Set<string>,
  categoryTokens: Set<string>,
  weight: number
): number {
  let matches = 0;

  for (const token of categoryTokens) {
    if (queryTokens.has(token)) {
      matches += 1;
    }
  }

  return matches * weight;
}

function tokenize(input: string): Set<string> {
  return new Set(
    normalizeText(input)
      .split(" ")
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
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
