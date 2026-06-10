import type { CategoryDTO } from "@move/shared";

export interface KeywordInput {
  description: string;
  availableCategories: CategoryDTO[];
}

// R10 – fallback keyword-match strategy
export function classifyWithKeyword(input: KeywordInput): string | null {
  const normalized = input.description.toLowerCase();

  for (const category of input.availableCategories) {
    const normalizedName = category.name.toLowerCase();
    const nameKeywords = normalizedName.split(/\s+/).filter((keyword) => keyword.length > 2);
    const descriptionMatches = category.descriptions.some((description) =>
      normalized.includes(description.toLowerCase())
    );

    if (
      normalized.includes(normalizedName) ||
      descriptionMatches ||
      nameKeywords.some((kw) => normalized.includes(kw))
    ) {
      return category.id;
    }
  }
  return null;
}
