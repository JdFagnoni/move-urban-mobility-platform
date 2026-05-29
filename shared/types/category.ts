export interface CategoryDTO {
  id: string;
  name: string;
  rules: CategoryRule[];
  pricing: CategoryPricingConfig;
  behavior: CategoryBehaviorConfig;
}

export interface CategoryRule {
  field: string;
  operator: "eq" | "gte" | "lte" | "in";
  value: unknown;
}

export type CategorySurchargeType = "fixed" | "percentage";

export interface CategoryPricingConfig {
  baseFare: number;
  pricePerKm: number;
  surchargeType: CategorySurchargeType;
  surchargeValue: number;
}

export interface CategoryBehaviorConfig {
  requiresMonitoring: boolean;
  generatesAlerts: boolean;
}

export const DEFAULT_CATEGORY_PRICING: CategoryPricingConfig = {
  baseFare: 100,
  pricePerKm: 10,
  surchargeType: "fixed",
  surchargeValue: 0,
};

export const DEFAULT_CATEGORY_BEHAVIOR: CategoryBehaviorConfig = {
  requiresMonitoring: false,
  generatesAlerts: false,
};
