import { query } from "@move/shared";
import type { CategoryDTO } from "@move/shared";

const CATEGORIZER_URL =
  process.env["CATEGORIZER_SERVICE_URL"] ?? "http://localhost:3003";

interface CategoryRow {
  id: string;
  name: string;
}

interface CategorizeResponse {
  success: boolean;
  data?: { categoryId: string };
}

async function fetchActiveCategories(): Promise<CategoryDTO[]> {
  const result = await query<CategoryRow>(
    "SELECT id, name FROM categories WHERE active = true ORDER BY name"
  );
  return result.rows.map((row) => ({ id: row.id, name: row.name, rules: [] }));
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
