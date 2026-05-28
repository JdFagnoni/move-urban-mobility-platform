import { HttpError } from "@move/shared";
import { Op } from "sequelize";
import { CompanyProductModel } from "../../../db/models";
import type { NormalizedCargoItemInput, PreparedCargoItemInput } from "./types";

export async function resolveCompanyProducts(
  clientId: string,
  cargoItems: NormalizedCargoItemInput[]
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

  const companyProducts = await CompanyProductModel.findAll({
    where: {
      clientId,
      id: { [Op.in]: [...new Set(productIds)] },
    },
  });

  const productsById = new Map(companyProducts.map((row) => [row.id, row]));

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
