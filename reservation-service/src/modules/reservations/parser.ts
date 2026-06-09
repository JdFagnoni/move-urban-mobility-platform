import type { Request } from "express";
import { HttpError, RESERVATION_STATUSES, type ListReservationsQueryDTO } from "@move/shared";
import type { ReservationStatus } from "@move/shared";

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
