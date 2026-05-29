import type { CategoryDTO } from "@move/shared";
import { HttpError } from "@move/shared";
import { CategoryModel } from "../../db/models";
import { normalizeCategoryBehaviorConfig, normalizeCategoryPricingConfig } from "./config";

function mapCategory(category: CategoryModel): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    rules: category.rules,
    pricing: normalizeCategoryPricingConfig(category.pricing),
    behavior: normalizeCategoryBehaviorConfig(category.behavior),
  };
}

export async function listCategories(): Promise<CategoryDTO[]> {
  const categories = await CategoryModel.findAll({
    order: [["name", "ASC"]],
  });
  return categories.map(mapCategory);
}

export async function getCategory(id: string): Promise<CategoryDTO | null> {
  const category = await CategoryModel.findByPk(id);
  return category ? mapCategory(category) : null;
}

export async function getCategoryForHttp(id: string): Promise<CategoryDTO> {
  const category = await getCategory(id);
  if (!category) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }

  return category;
}

export async function createCategory(dto: Omit<CategoryDTO, "id">): Promise<CategoryDTO> {
  const name = dto.name.trim();
  if (!name) {
    throw new HttpError(400, "Category name is required", "invalid_category");
  }

  const category = await CategoryModel.create({
    id: crypto.randomUUID(),
    name,
    active: true,
    rules: dto.rules ?? [],
    pricing: normalizeCategoryPricingConfig(dto.pricing),
    behavior: normalizeCategoryBehaviorConfig(dto.behavior),
  });
  return mapCategory(category);
}

export async function updateCategory(
  id: string,
  dto: Partial<Omit<CategoryDTO, "id">>
): Promise<CategoryDTO> {
  const category = await CategoryModel.findByPk(id);
  if (!category) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }

  if (dto.name !== undefined) {
    const name = dto.name.trim();
    if (!name) {
      throw new HttpError(400, "Category name is required", "invalid_category");
    }
    category.name = name;
  }

  if (dto.rules !== undefined) {
    category.rules = dto.rules;
  }

  if (dto.pricing !== undefined) {
    category.pricing = normalizeCategoryPricingConfig(dto.pricing);
  }

  if (dto.behavior !== undefined) {
    category.behavior = normalizeCategoryBehaviorConfig(dto.behavior);
  }

  await category.save();
  return mapCategory(category);
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await CategoryModel.findByPk(id);
  if (!category) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }

  await category.destroy();
}
