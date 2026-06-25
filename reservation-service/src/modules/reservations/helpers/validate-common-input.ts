import { HttpError, type CreateCargoItemDTO, type GeoPoint } from "@move/shared";
import type { NormalizedCargoItemInput } from "./types";

export function validateScheduledAt(value: string): Date {
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    throw new HttpError(400, "scheduledAt must be a future date", "invalid_scheduled_at");
  }

  return scheduledAt;
}

export function normalizeCargoItems(cargoItems: CreateCargoItemDTO[]): NormalizedCargoItemInput[] {
  if (cargoItems.length === 0) {
    throw new HttpError(400, "At least one cargo item is required", "cargo_items_required");
  }

  return cargoItems.map((cargoItem, index) => {
    const companyProductId = normalizeOptionalIdentifier(cargoItem.companyProductId);

    return {
      description: normalizeRequiredText(
        cargoItem.description,
        `cargoItems[${index}].description`,
        "invalid_cargo_item"
      ),
      estimatedValue: cargoItem.estimatedValue ?? null,
      size: normalizeOptionalText(cargoItem.size),
      ...(companyProductId ? { companyProductId } : {}),
    };
  });
}

export function requireGeoPoint(
  value: GeoPoint | undefined,
  field: string,
  code = "invalid_reservation"
): GeoPoint {
  if (!value) {
    throw new HttpError(400, `${field} is required`, code);
  }

  return value;
}

export function normalizeOptionalIdentifier(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, "Identifier cannot be empty", "invalid_reservation");
  }

  return normalized;
}

function normalizeRequiredText(value: string, field: string, code: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, `${field} is required`, code);
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}
