import type { CreateCategoryDTO, UpdateCategoryDTO } from "@move/shared";
import { HttpError } from "@move/shared";

export function parseCreateCategoryDTO(input: unknown): CreateCategoryDTO {
  const payload = getPayload(input);
  const descriptions = parseOptionalStringArray(payload["descriptions"], "descriptions");
  const pricing = parseOptionalObject(
    payload["pricing"],
    "pricing"
  ) as CreateCategoryDTO["pricing"];
  const behavior = parseOptionalObject(
    payload["behavior"],
    "behavior"
  ) as CreateCategoryDTO["behavior"];
  const active = parseOptionalBoolean(payload["active"], "active");

  const dto: CreateCategoryDTO = {
    name: parseRequiredString(payload["name"], "name"),
    spanishName: parseRequiredString(payload["spanishName"], "spanishName"),
  };

  if (descriptions !== undefined) {
    dto.descriptions = descriptions;
  }
  if (pricing !== undefined) {
    dto.pricing = pricing;
  }
  if (behavior !== undefined) {
    dto.behavior = behavior;
  }
  if (active !== undefined) {
    dto.active = active;
  }

  return dto;
}

export function parseUpdateCategoryDTO(input: unknown): UpdateCategoryDTO {
  const payload = getPayload(input);
  const dto: UpdateCategoryDTO = {};

  if (payload["name"] !== undefined) {
    dto.name = parseRequiredString(payload["name"], "name");
  }

  if (payload["spanishName"] !== undefined) {
    dto.spanishName = parseRequiredString(payload["spanishName"], "spanishName");
  }

  if (payload["descriptions"] !== undefined) {
    const descriptions = parseOptionalStringArray(payload["descriptions"], "descriptions");
    if (descriptions !== undefined) {
      dto.descriptions = descriptions;
    }
  }

  if (payload["pricing"] !== undefined) {
    const pricing = parseOptionalObject(
      payload["pricing"],
      "pricing"
    ) as UpdateCategoryDTO["pricing"];
    if (pricing !== undefined) {
      dto.pricing = pricing;
    }
  }

  if (payload["behavior"] !== undefined) {
    const behavior = parseOptionalObject(
      payload["behavior"],
      "behavior"
    ) as UpdateCategoryDTO["behavior"];
    if (behavior !== undefined) {
      dto.behavior = behavior;
    }
  }

  if (payload["active"] !== undefined) {
    const active = parseOptionalBoolean(payload["active"], "active");
    if (active !== undefined) {
      dto.active = active;
    }
  }

  return dto;
}

function getPayload(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "A valid category payload is required", "invalid_category");
  }

  return input as Record<string, unknown>;
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required`, "invalid_category");
  }

  return value;
}

function parseOptionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new HttpError(400, `${field} must be an array of strings`, "invalid_category");
  }

  return [...value];
}

function parseOptionalObject(
  value: unknown,
  field: string
): Record<string, unknown> | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an object`, "invalid_category");
  }

  return value as Record<string, unknown>;
}

function parseOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new HttpError(400, `${field} must be a boolean`, "invalid_category");
  }

  return value;
}
