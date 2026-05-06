import type { CategoryDTO } from "@move/shared";

// F8 – reglas y categorías
export async function listCategories(): Promise<CategoryDTO[]> {
  // TODO: fetch from DB
  return [];
}

export async function getCategory(id: string): Promise<CategoryDTO | null> {
  void id;
  return null;
}

export async function createCategory(
  dto: Omit<CategoryDTO, "id">
): Promise<CategoryDTO> {
  return { id: crypto.randomUUID(), ...dto };
}

export async function updateCategory(
  id: string,
  dto: Partial<Omit<CategoryDTO, "id">>
): Promise<CategoryDTO | null> {
  void id;
  void dto;
  return null;
}

export async function deleteCategory(id: string): Promise<boolean> {
  void id;
  return false;
}
