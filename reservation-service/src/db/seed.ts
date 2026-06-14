import { Op } from "sequelize";
import { recordAuditLog } from "../modules/auth/audit";
import {
  normalizeCategoryBehaviorConfig,
  normalizeCategoryDescriptions,
  normalizeCategoryPricingConfig,
} from "../modules/categories/config";
import { createUserRecord, getUserByAuthSubject, getUserByEmail } from "../modules/users/service";
import { loadSeedCategories } from "./category-seed";
import { CategoryModel } from "./models";

export async function seedDefaultCategories(): Promise<void> {
  const seedCategories = await loadSeedCategories();

  for (const category of seedCategories) {
    const existingCategory = await CategoryModel.findOne({
      where: {
        [Op.or]: [
          { id: category.id },
          { name: category.name },
          { spanishName: category.spanishName },
        ],
      },
    });

    if (!existingCategory) {
      await CategoryModel.create({
        id: category.id,
        name: category.name,
        spanishName: category.spanishName,
        descriptions: normalizeCategoryDescriptions(category.descriptions),
        active: true,
        pricing: normalizeCategoryPricingConfig(),
        behavior: normalizeCategoryBehaviorConfig(),
      });
      continue;
    }

    existingCategory.name = category.name;
    existingCategory.spanishName = category.spanishName;
    existingCategory.descriptions = normalizeCategoryDescriptions(category.descriptions);
    existingCategory.active = true;
    existingCategory.pricing = normalizeCategoryPricingConfig(existingCategory.pricing);
    existingCategory.behavior = normalizeCategoryBehaviorConfig(existingCategory.behavior);
    await existingCategory.save();
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
