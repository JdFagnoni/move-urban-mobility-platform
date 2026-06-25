import type { Request } from "express";
import {
  HttpError,
  RESERVATION_STATUSES,
  type AssignReservationDTO,
  type ListReservationsQueryDTO,
  type ManualReservationClassificationDTO,
  type RejectReservationDTO,
  type ReservationStatus,
} from "@move/shared";

export function parseAssignReservationDTO(body: unknown): AssignReservationDTO {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body is required", "invalid_body");
  }
  const raw = body as Record<string, unknown>;
  const vehicleId = raw["vehicleId"];
  const driverId = raw["driverId"];

  if (typeof vehicleId !== "string" || !vehicleId.trim()) {
    throw new HttpError(400, "vehicleId is required", "invalid_vehicle_id");
  }
  if (typeof driverId !== "string" || !driverId.trim()) {
    throw new HttpError(400, "driverId is required", "invalid_driver_id");
  }
  return { vehicleId: vehicleId.trim(), driverId: driverId.trim() };
}

export function parseListReservationsQuery(query: Request["query"]): ListReservationsQueryDTO {
  const filters: ListReservationsQueryDTO = {};
  const scheduledFrom = parseOptionalIsoDate(query["scheduledFrom"], "scheduledFrom");
  const scheduledTo = parseOptionalIsoDate(query["scheduledTo"], "scheduledTo");
  const status = parseOptionalStatus(query["status"]);
  const page = parseOptionalPositiveInteger(query["page"], "page");
  const pageSize = parseOptionalPositiveInteger(query["pageSize"], "pageSize");

  if (scheduledFrom) {
    filters.scheduledFrom = scheduledFrom;
  }

  if (scheduledTo) {
    filters.scheduledTo = scheduledTo;
  }

  if (scheduledFrom && scheduledTo && new Date(scheduledFrom) > new Date(scheduledTo)) {
    throw new HttpError(
      400,
      "scheduledFrom must be earlier than or equal to scheduledTo",
      "invalid_reservation_filters"
    );
  }

  if (status) {
    filters.status = status;
  }

  if (page !== undefined) {
    filters.page = page;
  }

  if (pageSize !== undefined) {
    filters.pageSize = pageSize;
  }

  return filters;
}

export function parseManualReservationClassification(
  body: unknown
): ManualReservationClassificationDTO {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object", "invalid_reservation");
  }

  const cargoItems = body["cargoItems"];
  if (!Array.isArray(cargoItems) || cargoItems.length === 0) {
    throw new HttpError(
      400,
      "cargoItems must be a non-empty array",
      "invalid_reservation_classification"
    );
  }

  return {
    cargoItems: cargoItems.map((item, index) => {
      if (!isRecord(item)) {
        throw new HttpError(
          400,
          `cargoItems[${index}] must be an object`,
          "invalid_reservation_classification"
        );
      }

      return {
        cargoItemId: parseRequiredString(
          item["cargoItemId"],
          `cargoItems[${index}].cargoItemId`,
          "invalid_reservation_classification"
        ),
        categoryId: parseRequiredString(
          item["categoryId"],
          `cargoItems[${index}].categoryId`,
          "invalid_reservation_classification"
        ),
      };
    }),
  };
}

export function parseRejectReservation(body: unknown): RejectReservationDTO {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object", "invalid_reservation");
  }

  return {
    reason: parseRequiredString(body["reason"], "reason", "invalid_reservation_rejection"),
  };
}

function parseOptionalIsoDate(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`, "invalid_reservation_filters");
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, `${field} cannot be empty`, "invalid_reservation_filters");
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `${field} must be a valid ISO date`, "invalid_reservation_filters");
  }

  return parsed.toISOString();
}

function parseOptionalStatus(value: unknown): ReservationStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, "status must be a string", "invalid_reservation_filters");
  }

  if (!RESERVATION_STATUSES.includes(value as ReservationStatus)) {
    throw new HttpError(400, "status is invalid", "invalid_reservation_filters");
  }

  return value as ReservationStatus;
}

function parseOptionalPositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`, "invalid_reservation_filters");
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${field} must be a positive integer`, "invalid_reservation_filters");
  }

  return parsed;
}

function parseRequiredString(value: unknown, field: string, code: string): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`, code);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new HttpError(400, `${field} is required`, code);
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
