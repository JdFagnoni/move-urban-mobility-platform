export interface CategoryDTO {
  id: string;
  name: string;
  descriptions: string[];
  pricing: CategoryPricingConfig;
  behavior: CategoryBehaviorConfig;
  active: boolean;
}

export interface CreateCategoryDTO {
  name: string;
  descriptions?: string[];
  pricing?: Partial<CategoryPricingConfig> | null;
  behavior?: Partial<CategoryBehaviorConfig> | null;
  active?: boolean;
}

export interface UpdateCategoryDTO {
  name?: string;
  descriptions?: string[];
  pricing?: Partial<CategoryPricingConfig> | null;
  behavior?: Partial<CategoryBehaviorConfig> | null;
  active?: boolean;
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
