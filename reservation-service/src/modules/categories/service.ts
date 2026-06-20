import type { CategoryDTO, CreateCategoryDTO, UpdateCategoryDTO } from "@move/shared";
import { EXCHANGES, HttpError, ROUTING_KEYS } from "@move/shared";
import type { Transaction } from "sequelize";
import { CargoItemModel, CategoryModel, CompanyProductModel } from "../../db/models";
import { sequelize } from "../../db/sequelize";
import { OUTBOX_EVENT_TYPES } from "../../messaging/events";
import { enqueueOutboxEvent } from "../../messaging/outbox";
import { refreshCategoryQuoteCache } from "../reservations/fast-path-cache";
import {
  normalizeCategoryBehaviorConfig,
  normalizeCategoryDescriptions,
  normalizeCategoryPricingConfig,
} from "./config";

async function enqueueCategoryChanged(
  categoryId: string,
  trigger: "created" | "updated" | "deleted",
  transaction: Transaction,
): Promise<void> {
  await enqueueOutboxEvent(
    {
      aggregateId: categoryId,
      type: OUTBOX_EVENT_TYPES.categoryChanged,
      exchange: EXCHANGES.categories,
      routingKey: ROUTING_KEYS.categoryChanged,
      payload: { trigger },
    },
    transaction,
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

  const category = await sequelize.transaction(async (transaction) => {
    const created = await CategoryModel.create(
      {
        id: crypto.randomUUID(),
        name,
        spanishName,
        active: dto.active ?? true,
        descriptions: normalizeCategoryDescriptions(dto.descriptions),
        pricing: normalizeCategoryPricingConfig(dto.pricing),
        behavior: normalizeCategoryBehaviorConfig(dto.behavior),
      },
      { transaction },
    );
    await enqueueCategoryChanged(created.id, "created", transaction);
    return created;
  });
  await refreshCategoryQuoteCache();
  return mapCategory(category);
}

export async function updateCategory(id: string, dto: UpdateCategoryDTO): Promise<CategoryDTO> {
  const category = await sequelize.transaction(async (transaction) => {
    const found = await CategoryModel.findByPk(id, { transaction });
    if (!found) {
      throw new HttpError(404, "Category not found", "category_not_found");
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new HttpError(400, "Category name is required", "invalid_category");
      }
      found.name = name;
    }

    if (dto.spanishName !== undefined) {
      const spanishName = dto.spanishName.trim();
      if (!spanishName) {
        throw new HttpError(400, "Category spanishName is required", "invalid_category");
      }
      found.spanishName = spanishName;
    }

    if (dto.descriptions !== undefined) {
      found.descriptions = normalizeCategoryDescriptions(dto.descriptions);
    }

    if (dto.pricing !== undefined) {
      found.pricing = normalizeCategoryPricingConfig(dto.pricing);
    }

    if (dto.behavior !== undefined) {
      found.behavior = normalizeCategoryBehaviorConfig(dto.behavior);
    }

    if (dto.active !== undefined) {
      found.active = dto.active;
    }

    await found.save({ transaction });
    await enqueueCategoryChanged(id, "updated", transaction);
    return found;
  });
  await refreshCategoryQuoteCache();
  return mapCategory(category);
}

export async function deleteCategory(id: string): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const category = await CategoryModel.findByPk(id, { transaction });
    if (!category) {
      throw new HttpError(404, "Category not found", "category_not_found");
    }

    await ensureCategoryIsNotInUse(category.id);
    await category.destroy({ transaction });
    await enqueueCategoryChanged(id, "deleted", transaction);
  });
  await refreshCategoryQuoteCache();
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
