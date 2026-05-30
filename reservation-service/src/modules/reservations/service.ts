import { HttpError } from "@move/shared";
import type {
  CargoItemDTO,
  CreateReservationDTO,
  GeoPoint,
  ListReservationsQueryDTO,
  PaymentDTO,
  PaginatedResult,
  ReservationDTO,
  ReservationStatus,
  UserDTO,
} from "@move/shared";
import { Op, type WhereOptions } from "sequelize";
import { CargoItemModel, PaymentModel, ReservationModel } from "../../db/models";
import { sequelize } from "../../db/sequelize";
import { createCompanyReservation } from "./helpers/create-company-reservation";
import { createIndividualReservation } from "./helpers/create-individual-reservation";
import { normalizeCargoItems, validateScheduledAt } from "./helpers/validate-common-input";
import { quotePreparedReservation } from "./quote-service";

function modelToCargoItemDTO(row: CargoItemModel): CargoItemDTO {
  return {
    id: row.id,
    reservationId: row.reservationId,
    description: row.description,
    estimatedValue: row.estimatedValue !== null ? parseFloat(row.estimatedValue) : null,
    size: row.size,
    categoryId: row.categoryId,
  };
}

export function sortCargoItemsByCreatedAt(cargoItems: CargoItemModel[]): CargoItemModel[] {
  return cargoItems.slice().sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
}

export function mapPaymentModelToDTO(row: PaymentModel): PaymentDTO {
  return {
    id: row.id,
    reservationId: row.reservationId,
    provider: row.provider,
    providerPaymentIntentId: row.providerPaymentIntentId,
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    failureReason: row.failureReason,
    providerResponseCode: row.providerResponseCode,
    providerEventId: row.providerEventId,
    requestedByUserId: row.requestedByUserId,
    paymentMethodType: row.paymentMethodType,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapReservationModelToDTO(
  row: ReservationModel,
  cargoItems: CargoItemModel[]
): ReservationDTO {
  return {
    id: row.id,
    clientId: row.clientId,
    origin: row.origin as GeoPoint,
    destination: row.destination as GeoPoint,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    quotedPrice: row.quotedPrice !== null ? parseFloat(row.quotedPrice) : null,
    vehicleId: row.vehicleId,
    driverId: row.driverId,
    cargoItems: cargoItems.map(modelToCargoItemDTO),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const CANCELLABLE_STATUSES: readonly ReservationStatus[] = [
  "pending_classification",
  "pending_quote",
  "pending_confirmation",
  "confirmed",
];

export async function loadReservationWithRelations(id: string): Promise<ReservationModel | null> {
  return ReservationModel.findByPk(id, {
    include: [{ model: CargoItemModel, as: "cargoItems" }],
  });
}

export async function createReservation(
  dto: CreateReservationDTO,
  clientUser: UserDTO
): Promise<ReservationDTO> {
  if (clientUser.role !== "client") {
    throw new HttpError(403, "Only clients can create reservations", "forbidden");
  }

  const scheduledAt = validateScheduledAt(dto.scheduledAt);
  const normalizedCargoItems = normalizeCargoItems(dto.cargoItems);
  const reservationId = crypto.randomUUID();
  const preparedReservation =
    clientUser.clientType === "company"
      ? await createCompanyReservation({ dto, clientUser, cargoItems: normalizedCargoItems })
      : clientUser.clientType === "individual"
        ? await createIndividualReservation({ dto, cargoItems: normalizedCargoItems })
        : (() => {
            throw new HttpError(
              400,
              "Client type is required to create reservations",
              "invalid_reservation"
            );
          })();
  const quote =
    preparedReservation.status === "pending_quote"
      ? await quotePreparedReservation({
          origin: preparedReservation.origin,
          destination: preparedReservation.destination,
          cargoItems: preparedReservation.cargoItems,
        })
      : null;
  const finalStatus: ReservationStatus =
    quote !== null ? "pending_confirmation" : preparedReservation.status;

  await sequelize.transaction(async (transaction) => {
    await ReservationModel.create(
      {
        id: reservationId,
        clientId: clientUser.id,
        origin: preparedReservation.origin,
        destination: preparedReservation.destination,
        scheduledAt,
        status: finalStatus,
        quotedPrice: quote?.quotedPrice ?? null,
      },
      { transaction }
    );

    await CargoItemModel.bulkCreate(
      preparedReservation.cargoItems.map((cargoItem) => ({
        id: crypto.randomUUID(),
        reservationId,
        description: cargoItem.description,
        estimatedValue: cargoItem.estimatedValue,
        size: cargoItem.size,
        categoryId: cargoItem.categoryId,
      })),
      { transaction }
    );
  });

  const reservation = await loadReservationWithRelations(reservationId);
  if (!reservation) {
    throw new HttpError(500, "Reservation creation failed", "reservation_create_failed");
  }

  const sortedCargoItems = sortCargoItemsByCreatedAt(reservation.cargoItems ?? []);
  return mapReservationModelToDTO(reservation, sortedCargoItems);
}

export async function getReservation(id: string, clientUser: UserDTO): Promise<ReservationDTO> {
  const reservation = await loadReservationWithRelations(id);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (clientUser.role === "client" && reservation.clientId !== clientUser.id) {
    throw new HttpError(403, "Access denied", "forbidden");
  }

  const cargoItems = sortCargoItemsByCreatedAt(reservation.cargoItems ?? []);
  return mapReservationModelToDTO(reservation, cargoItems);
}

export async function listReservations(
  clientUser: UserDTO,
  filters: ListReservationsQueryDTO
): Promise<PaginatedResult<ReservationDTO>> {
  const page = parsePositiveInteger(filters.page, 1);
  const pageSize = parsePositiveInteger(filters.pageSize, 20);
  const offset = (page - 1) * pageSize;
  const where: WhereOptions<ReservationModel> = {};

  if (clientUser.role === "client") {
    where.clientId = clientUser.id;
  }

  if (filters.scheduledFrom || filters.scheduledTo) {
    where.scheduledAt =
      filters.scheduledFrom && filters.scheduledTo
        ? { [Op.between]: [new Date(filters.scheduledFrom), new Date(filters.scheduledTo)] }
        : filters.scheduledFrom
          ? { [Op.gte]: new Date(filters.scheduledFrom) }
          : { [Op.lte]: new Date(filters.scheduledTo as string) };
  }

  if (filters.status) {
    where.status = filters.status;
  }

  const result = await ReservationModel.findAndCountAll({
    where,
    include: [{ model: CargoItemModel, as: "cargoItems" }],
    distinct: true,
    order: [["created_at", "DESC"]],
    limit: pageSize,
    offset,
  });

  const data = result.rows.map((reservation) => {
    const cargoItems = sortCargoItemsByCreatedAt(reservation.cargoItems ?? []);
    return mapReservationModelToDTO(reservation, cargoItems);
  });

  return { data, total: result.count, page, pageSize };
}

export async function cancelReservation(id: string, clientUser: UserDTO): Promise<ReservationDTO> {
  const reservation = await loadReservationWithRelations(id);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (clientUser.role === "client" && reservation.clientId !== clientUser.id) {
    throw new HttpError(403, "Access denied", "forbidden");
  }

  if (!CANCELLABLE_STATUSES.includes(reservation.status)) {
    throw new HttpError(
      409,
      `Cannot cancel a reservation with status '${reservation.status}'`,
      "invalid_status_transition"
    );
  }

  reservation.status = "cancelled";
  await reservation.save();

  const cargoItems = sortCargoItemsByCreatedAt(reservation.cargoItems ?? []);
  return mapReservationModelToDTO(reservation, cargoItems);
}
