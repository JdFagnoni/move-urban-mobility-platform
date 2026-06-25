import type { CategoryDTO } from "@move/shared";

export interface CategorizationStrategyInput {
  description: string;
  availableCategories: CategoryDTO[];
}

export interface StrategyDiagnostics {
  categoryId: string | null;
  rawLabel?: string;
  error?: string;
}
