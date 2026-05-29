import { HttpError, type CategoryDTO, type GeoPoint } from "@move/shared";
import { Op } from "sequelize";
import { CategoryModel } from "../../db/models";
import {
  normalizeCategoryBehaviorConfig,
  normalizeCategoryPricingConfig,
} from "../categories/config";
import type { PreparedCargoItemInput } from "./helpers/types";

interface QuotePreparedReservationInput {
  origin: GeoPoint;
  destination: GeoPoint;
  cargoItems: PreparedCargoItemInput[];
}

interface QuoteResult {
  quotedPrice: number;
}

export async function quotePreparedReservation(
  input: QuotePreparedReservationInput
): Promise<QuoteResult> {
  const categoryIds = input.cargoItems.map((cargoItem) => cargoItem.categoryId);

  if (categoryIds.some((categoryId) => categoryId === null)) {
    throw new HttpError(
      409,
      "Cannot quote a reservation with uncategorized cargo items",
      "reservation_not_quotable"
    );
  }

  const categories = await CategoryModel.findAll({
    where: {
      id: {
        [Op.in]: [...new Set(categoryIds)],
      },
    },
  });

  if (categories.length !== new Set(categoryIds).size) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }

  const categoryDTOs: CategoryDTO[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    rules: category.rules,
    pricing: normalizeCategoryPricingConfig(category.pricing),
    behavior: normalizeCategoryBehaviorConfig(category.behavior),
  }));

  const distanceKm = calculateDistanceKm(input.origin, input.destination);
  const appliedCategory = selectAppliedCategory(categoryDTOs, distanceKm);

  return {
    quotedPrice: roundCurrency(calculateQuoteTotal(appliedCategory, distanceKm)),
  };
}

function selectAppliedCategory(categories: CategoryDTO[], distanceKm: number): CategoryDTO {
  return categories.reduce((highestCategory, currentCategory) =>
    calculateQuoteTotal(currentCategory, distanceKm) >
    calculateQuoteTotal(highestCategory, distanceKm)
      ? currentCategory
      : highestCategory
  );
}

function calculateQuoteTotal(category: CategoryDTO, distanceKm: number): number {
  const baseAmount = category.pricing.baseFare + distanceKm * category.pricing.pricePerKm;
  const surcharge =
    category.pricing.surchargeType === "percentage"
      ? (baseAmount * category.pricing.surchargeValue) / 100
      : category.pricing.surchargeValue;

  return baseAmount + surcharge;
}

function calculateDistanceKm(origin: GeoPoint, destination: GeoPoint): number {
  const [originLongitude, originLatitude] = origin.coordinates;
  const [destinationLongitude, destinationLatitude] = destination.coordinates;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(destinationLatitude - originLatitude);
  const deltaLongitude = toRadians(destinationLongitude - originLongitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(originLatitude)) *
      Math.cos(toRadians(destinationLatitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
