import type { CategoryDTO } from "@move/shared";
import { loadActiveCategories } from "../categories";

export async function loadEvaluationCategories(): Promise<CategoryDTO[]> {
  return loadActiveCategories();
}
