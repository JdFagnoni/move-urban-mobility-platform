import type { CategoryBehaviorConfig, CategoryPricingConfig } from "@move/shared";
import { recordAuditLog } from "../modules/auth/audit";
import {
  normalizeCategoryBehaviorConfig,
  normalizeCategoryPricingConfig,
} from "../modules/categories/config";
import { createUserRecord, getUserByAuthSubject, getUserByEmail } from "../modules/users/service";
import { CategoryModel } from "./models";

type SeedCategory = {
  name: string;
  rules: [];
  pricing: Partial<CategoryPricingConfig>;
  behavior: Partial<CategoryBehaviorConfig>;
};

const DEFAULT_CATEGORIES: readonly SeedCategory[] = [
  {
    name: "Electronics",
    rules: [],
    pricing: { surchargeType: "percentage", surchargeValue: 20 },
    behavior: { requiresMonitoring: true, generatesAlerts: true },
  },
  {
    name: "Furniture",
    rules: [],
    pricing: { surchargeType: "fixed", surchargeValue: 30 },
    behavior: {},
  },
  {
    name: "Fragile Items",
    rules: [],
    pricing: { surchargeType: "percentage", surchargeValue: 15 },
    behavior: { requiresMonitoring: true },
  },
  {
    name: "Perishable Goods",
    rules: [],
    pricing: { surchargeType: "percentage", surchargeValue: 10 },
    behavior: { requiresMonitoring: true, generatesAlerts: true },
  },
  {
    name: "Clothing",
    rules: [],
    pricing: {},
    behavior: {},
  },
] as const;

export async function seedDefaultCategories(): Promise<void> {
  for (const category of DEFAULT_CATEGORIES) {
    const existingCategory = await CategoryModel.findOne({
      where: { name: category.name },
    });

    if (existingCategory) {
      let changed = false;

      if (!existingCategory.active) {
        existingCategory.active = true;
        changed = true;
      }

      existingCategory.pricing = normalizeCategoryPricingConfig(
        existingCategory.pricing ?? category.pricing
      );
      existingCategory.behavior = normalizeCategoryBehaviorConfig(
        existingCategory.behavior ?? category.behavior
      );
      changed = true;

      if (changed) {
        await existingCategory.save();
      }
      continue;
    }

    await CategoryModel.create({
      id: crypto.randomUUID(),
      name: category.name,
      active: true,
      rules: category.rules,
      pricing: normalizeCategoryPricingConfig(category.pricing),
      behavior: normalizeCategoryBehaviorConfig(category.behavior),
    });
  }
}

export async function seedBootstrapAdmin(): Promise<void> {
  const authSubject = process.env["BOOTSTRAP_ADMIN_AUTH_SUBJECT"];
  const email = process.env["BOOTSTRAP_ADMIN_EMAIL"];
  const name = process.env["BOOTSTRAP_ADMIN_NAME"] ?? "MOVE Admin";

  if (!authSubject || !email) {
    return;
  }

  const existingBySubject = await getUserByAuthSubject(authSubject);
  if (existingBySubject) {
    return;
  }

  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail) {
    return;
  }

  const user = await createUserRecord({
    authSubject,
    email,
    name,
    role: "admin",
    clientType: null,
  });

  await recordAuditLog({
    eventType: "registration_success",
    decision: "success",
    statusCode: 201,
    userId: user.id,
    authSubject: user.authSubject,
    email: user.email,
    role: user.role,
    reason: "Bootstrap admin linked from environment",
  });
}
