import { HttpError } from "@move/shared";
import { Op } from "sequelize";
import { CompanyProductModel } from "../../../db/models";
import {
  getCachedCompanyProductCategoryIds,
  refreshCompanyProductCacheForClient,
} from "../fast-path-cache";
import type { NormalizedCargoItemInput, PreparedCargoItemInput } from "./types";

export async function resolveCompanyProducts(
  clientId: string,
  cargoItems: NormalizedCargoItemInput[],
  options?: { preferCache?: boolean }
): Promise<PreparedCargoItemInput[]> {
  const productIds = cargoItems.map((cargoItem) => {
    if (!cargoItem.companyProductId) {
      throw new HttpError(
        400,
        "companyProductId is required for company clients",
        "invalid_company_product"
      );
    }

    return cargoItem.companyProductId;
  });

  const uniqueProductIds = [...new Set(productIds)];

  if (options?.preferCache) {
    const cachedProducts = await getCachedCompanyProductCategoryIds(clientId, uniqueProductIds);
    if (cachedProducts) {
      return cargoItems.map((cargoItem) => {
        const companyProductId = cargoItem.companyProductId as string;
        const categoryId = cachedProducts.get(companyProductId);
        if (!categoryId) {
          throw new HttpError(404, "Company product not found", "company_product_not_found");
        }

        return {
          description: cargoItem.description,
          estimatedValue: cargoItem.estimatedValue,
          size: cargoItem.size,
          categoryId,
        };
      });
    }
  }

  const companyProducts = await CompanyProductModel.findAll({
    where: {
      clientId,
      id: { [Op.in]: uniqueProductIds },
    },
  });

  const productsById = new Map(companyProducts.map((row) => [row.id, row]));

  if (options?.preferCache) {
    void refreshCompanyProductCacheForClient(clientId);
  }

  return cargoItems.map((cargoItem) => {
    const companyProductId = cargoItem.companyProductId;
    if (!companyProductId) {
      throw new HttpError(
        400,
        "companyProductId is required for company clients",
        "invalid_company_product"
      );
    }

    const companyProduct = productsById.get(companyProductId);
    if (!companyProduct) {
      throw new HttpError(404, "Company product not found", "company_product_not_found");
    }

    return {
      description: cargoItem.description,
      estimatedValue: cargoItem.estimatedValue,
      size: cargoItem.size,
      categoryId: companyProduct.categoryId,
    };
  });
}
