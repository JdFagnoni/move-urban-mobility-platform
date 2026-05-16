import type { CategoryDTO } from "@move/shared";
import { HttpError } from "@move/shared";

// F8 – reglas y categorías
export async function listCategories(): Promise<CategoryDTO[]> {
  // TODO: fetch from DB
  return [];
}

export async function getCategory(id: string): Promise<CategoryDTO | null> {
  void id;
  return null;
}

export async function getCategoryForHttp(id: string): Promise<CategoryDTO> {
  const category = await getCategory(id);
  if (!category) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }

  return category;
}

export async function createCategory(dto: Omit<CategoryDTO, "id">): Promise<CategoryDTO> {
  return { id: crypto.randomUUID(), ...dto };
}

export async function updateCategory(
  id: string,
  dto: Partial<Omit<CategoryDTO, "id">>
): Promise<CategoryDTO> {
  await getCategoryForHttp(id);
  void dto;
  throw new HttpError(404, "Category not found", "category_not_found");
}

export async function deleteCategory(id: string): Promise<void> {
  await getCategoryForHttp(id);
  throw new HttpError(404, "Category not found", "category_not_found");
}
