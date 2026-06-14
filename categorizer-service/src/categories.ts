import {
  DEFAULT_CATEGORY_BEHAVIOR,
  DEFAULT_CATEGORY_PRICING,
  type CategoryBehaviorConfig,
  type CategoryDTO,
  type CategoryPricingConfig,
} from "@move/shared";
import { Pool } from "pg";

interface CategoryRow {
  id: string;
  name: string;
  spanish_name: string | null;
  descriptions: unknown;
  pricing: unknown;
  behavior: unknown;
  active: boolean;
}

let pool: Pool | null = null;

export async function loadActiveCategories(): Promise<CategoryDTO[]> {
  const result = await getPool().query<CategoryRow>(
    `SELECT id, name, spanish_name, descriptions, pricing, behavior, active
       FROM categories
      WHERE active = true
      ORDER BY name ASC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    spanishName: row.spanish_name ?? row.name,
    descriptions: normalizeDescriptions(row.descriptions),
    pricing: normalizePricing(row.pricing),
    behavior: normalizeBehavior(row.behavior),
    active: row.active,
  }));
}

function getPool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  pool = new Pool({ connectionString });
  return pool;
}

function normalizeDescriptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizePricing(value: unknown): CategoryPricingConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_CATEGORY_PRICING;
  }

  const pricing = value as Partial<CategoryPricingConfig>;
  return {
    baseFare:
      typeof pricing.baseFare === "number" ? pricing.baseFare : DEFAULT_CATEGORY_PRICING.baseFare,
    pricePerKm:
      typeof pricing.pricePerKm === "number"
        ? pricing.pricePerKm
        : DEFAULT_CATEGORY_PRICING.pricePerKm,
    surchargeType:
      pricing.surchargeType === "fixed" || pricing.surchargeType === "percentage"
        ? pricing.surchargeType
        : DEFAULT_CATEGORY_PRICING.surchargeType,
    surchargeValue:
      typeof pricing.surchargeValue === "number"
        ? pricing.surchargeValue
        : DEFAULT_CATEGORY_PRICING.surchargeValue,
  };
}

function normalizeBehavior(value: unknown): CategoryBehaviorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_CATEGORY_BEHAVIOR;
  }

  const behavior = value as Partial<CategoryBehaviorConfig>;
  return {
    requiresMonitoring:
      typeof behavior.requiresMonitoring === "boolean"
        ? behavior.requiresMonitoring
        : DEFAULT_CATEGORY_BEHAVIOR.requiresMonitoring,
    generatesAlerts:
      typeof behavior.generatesAlerts === "boolean"
        ? behavior.generatesAlerts
        : DEFAULT_CATEGORY_BEHAVIOR.generatesAlerts,
  };
}
