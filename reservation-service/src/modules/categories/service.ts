import type { CategoryDTO, CreateCategoryDTO, UpdateCategoryDTO } from "@move/shared";
import { EXCHANGES, HttpError, publish, ROUTING_KEYS } from "@move/shared";
import { CargoItemModel, CategoryModel, CompanyProductModel } from "../../db/models";
import { refreshCategoryQuoteCache } from "../reservations/fast-path-cache";
import {
  normalizeCategoryBehaviorConfig,
  normalizeCategoryDescriptions,
  normalizeCategoryPricingConfig,
} from "./config";

function publishCategoryChanged(trigger: "created" | "updated" | "deleted"): void {
  publish(EXCHANGES.categories, ROUTING_KEYS.categoryChanged, { trigger }).catch(
    (error: unknown) => {
      console.warn(
        `[reservations] failed to publish category.changed (${trigger}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  );
}

function mapCategory(category: CategoryModel): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    spanishName: category.spanishName ?? category.name,
    descriptions: normalizeCategoryDescriptions(category.descriptions),
    pricing: normalizeCategoryPricingConfig(category.pricing),
    behavior: normalizeCategoryBehaviorConfig(category.behavior),
    active: category.active,
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

export async function createCategory(dto: CreateCategoryDTO): Promise<CategoryDTO> {
  const name = dto.name.trim();
  const spanishName = dto.spanishName.trim();
  if (!name) {
    throw new HttpError(400, "Category name is required", "invalid_category");
  }
  if (!spanishName) {
    throw new HttpError(400, "Category spanishName is required", "invalid_category");
  }

  const category = await CategoryModel.create({
    id: crypto.randomUUID(),
    name,
    spanishName,
    active: dto.active ?? true,
    descriptions: normalizeCategoryDescriptions(dto.descriptions),
    pricing: normalizeCategoryPricingConfig(dto.pricing),
    behavior: normalizeCategoryBehaviorConfig(dto.behavior),
  });
  await refreshCategoryQuoteCache();
  publishCategoryChanged("created");
  return mapCategory(category);
}

export async function updateCategory(id: string, dto: UpdateCategoryDTO): Promise<CategoryDTO> {
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

  if (dto.spanishName !== undefined) {
    const spanishName = dto.spanishName.trim();
    if (!spanishName) {
      throw new HttpError(400, "Category spanishName is required", "invalid_category");
    }
    category.spanishName = spanishName;
  }

  if (dto.descriptions !== undefined) {
    category.descriptions = normalizeCategoryDescriptions(dto.descriptions);
  }

  if (dto.pricing !== undefined) {
    category.pricing = normalizeCategoryPricingConfig(dto.pricing);
  }

  if (dto.behavior !== undefined) {
    category.behavior = normalizeCategoryBehaviorConfig(dto.behavior);
  }

  if (dto.active !== undefined) {
    category.active = dto.active;
  }

  await category.save();
  await refreshCategoryQuoteCache();
  publishCategoryChanged("updated");
  return mapCategory(category);
}

export async function deleteCategory(id: string): Promise<void> {
  const category = await CategoryModel.findByPk(id);
  if (!category) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }

  await ensureCategoryIsNotInUse(category.id);
  await category.destroy();
  await refreshCategoryQuoteCache();
  publishCategoryChanged("deleted");
}

async function ensureCategoryIsNotInUse(categoryId: string): Promise<void> {
  const [reservationUsageCount, preregistrationUsageCount] = await Promise.all([
    CargoItemModel.count({ where: { categoryId } }),
    CompanyProductModel.count({ where: { categoryId } }),
  ]);

  if (reservationUsageCount > 0 || preregistrationUsageCount > 0) {
    throw new HttpError(409, "Category is in use and cannot be deleted", "category_in_use");
  }
}
