import {
  DEFAULT_CATEGORY_BEHAVIOR,
  DEFAULT_CATEGORY_PRICING,
  HttpError,
  type CategoryBehaviorConfig,
  type CategoryPricingConfig,
  type CategorySurchargeType,
} from "@move/shared";

const SURCHARGE_TYPES: readonly CategorySurchargeType[] = ["fixed", "percentage"];

export function normalizeCategoryPricingConfig(
  pricing?: Partial<CategoryPricingConfig> | null
): CategoryPricingConfig {
  const normalized: CategoryPricingConfig = {
    baseFare: pricing?.baseFare ?? DEFAULT_CATEGORY_PRICING.baseFare,
    pricePerKm: pricing?.pricePerKm ?? DEFAULT_CATEGORY_PRICING.pricePerKm,
    surchargeType: pricing?.surchargeType ?? DEFAULT_CATEGORY_PRICING.surchargeType,
    surchargeValue: pricing?.surchargeValue ?? DEFAULT_CATEGORY_PRICING.surchargeValue,
  };

  validateNonNegativeNumber(normalized.baseFare, "pricing.baseFare");
  validateNonNegativeNumber(normalized.pricePerKm, "pricing.pricePerKm");
  validateNonNegativeNumber(normalized.surchargeValue, "pricing.surchargeValue");

  if (!SURCHARGE_TYPES.includes(normalized.surchargeType)) {
    throw new HttpError(
      400,
      "pricing.surchargeType must be 'fixed' or 'percentage'",
      "invalid_category"
    );
  }

  if (normalized.surchargeType === "percentage" && normalized.surchargeValue > 100) {
    throw new HttpError(
      400,
      "pricing.surchargeValue cannot exceed 100 for percentage surcharges",
      "invalid_category"
    );
  }

  return normalized;
}

export function normalizeCategoryBehaviorConfig(
  behavior?: Partial<CategoryBehaviorConfig> | null
): CategoryBehaviorConfig {
  return {
    requiresMonitoring:
      behavior?.requiresMonitoring ?? DEFAULT_CATEGORY_BEHAVIOR.requiresMonitoring,
    generatesAlerts: behavior?.generatesAlerts ?? DEFAULT_CATEGORY_BEHAVIOR.generatesAlerts,
  };
}

function validateNonNegativeNumber(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `${field} must be a non-negative number`, "invalid_category");
  }
}
