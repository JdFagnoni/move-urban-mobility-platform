import type { CategoryDTO } from "@move/shared";
import { CategoryModel } from "../db/models";

const CATEGORIZER_URL =
  process.env["CATEGORIZER_SERVICE_URL"] ?? "http://localhost:3003";

interface CategorizeResponse {
  success: boolean;
  data?: { categoryId: string };
}

async function fetchActiveCategories(): Promise<CategoryDTO[]> {
  const categories = await CategoryModel.findAll({
    where: { active: true },
    order: [["name", "ASC"]],
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    rules: category.rules,
  }));
}

export async function classifyGood(description: string): Promise<string | null> {
  let availableCategories: CategoryDTO[];

  try {
    availableCategories = await fetchActiveCategories();
  } catch {
    return null;
  }

  if (availableCategories.length === 0) {
    return null;
  }

  try {
    const response = await fetch(`${CATEGORIZER_URL}/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, availableCategories }),
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as CategorizeResponse;
    return body.data?.categoryId ?? null;
  } catch {
    return null;
  }
}
