import type { CategoryDTO } from "@move/shared";

export interface KeywordInput {
  description: string;
  availableCategories: CategoryDTO[];
}

// R10 – fallback keyword-match strategy
export function classifyWithKeyword(input: KeywordInput): string | null {
  const normalized = input.description.toLowerCase();

  for (const category of input.availableCategories) {
    const keywords = category.name.toLowerCase().split(/\s+/);
    if (keywords.some((kw) => normalized.includes(kw))) {
      return category.id;
    }
  }
  return null;
}
