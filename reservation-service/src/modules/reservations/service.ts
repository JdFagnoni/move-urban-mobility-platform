import { EXCHANGES, HttpError, ROUTING_KEYS } from "@move/shared";
import type {
  AssignReservationDTO,
  CargoItemDTO,
  CreateReservationDTO,
  GeoPoint,
  ListReservationsQueryDTO,
  ManualReservationClassificationDTO,
  NotificationDTO,
  PaginatedResult,
  PaymentDTO,
  RejectReservationDTO,
  ReservationDTO,
  ReservationStatus,
  UserDTO,
} from "@move/shared";
import { Op, type Transaction, type WhereOptions } from "sequelize";
import type { PaymentModel } from "../../db/models";
import {
  CargoItemModel,
  CategoryModel,
  NotificationModel,
  ReservationModel,
  VehicleReadModel,
} from "../../db/models";
import { sequelize } from "../../db/sequelize";
import { getUser } from "../users/service";
import { createCompanyReservation } from "./helpers/create-company-reservation";
import { createIndividualReservation } from "./helpers/create-individual-reservation";
import type { PreparedCargoItemInput } from "./helpers/types";
import { normalizeCargoItems, validateScheduledAt } from "./helpers/validate-common-input";
import { quotePreparedReservation } from "./quote-service";
import { enqueueOutboxEvent } from "../../messaging/outbox";
import { OUTBOX_EVENT_TYPES } from "../../messaging/events";
import { isFrequentCompanyClient } from "./fast-path-cache";

function modelToCargoItemDTO(row: CargoItemModel): CargoItemDTO {
  return {
    id: row.id,
    reservationId: row.reservationId,
    description: row.description,
    estimatedValue: row.estimatedValue !== null ? parseFloat(row.estimatedValue) : null,
    size: row.size,
    categoryId: row.categoryId,
    category: row.category?.name ?? null,
  };
}

function modelToNotificationDTO(row: NotificationModel): NotificationDTO {
  return {
    id: row.id,
    reservationId: row.reservationId,
    type: row.type,
    status: row.status,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    acknowledgedByUserId: row.acknowledgedByUserId,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
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
    providerPaymentId: row.providerPaymentId,
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
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectedByUserId: row.rejectedByUserId,
    rejectionReason: row.rejectionReason,
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
    include: [reservationCargoItemsInclude],
  });
}

const reservationCargoItemsInclude = {
  model: CargoItemModel,
  as: "cargoItems",
  include: [
    {
      model: CategoryModel,
      as: "category",
      required: false,
    },
  ],
};

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
  const preferCache =
    clientUser.clientType === "company" ? await isFrequentCompanyClient(clientUser.id) : false;
  const preparedReservation =
    clientUser.clientType === "company"
      ? await createCompanyReservation({
          dto,
          clientUser,
          cargoItems: normalizedCargoItems,
          preferCache,
        })
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
      ? await quotePreparedReservation(
          {
            origin: preparedReservation.origin,
            destination: preparedReservation.destination,
            cargoItems: preparedReservation.cargoItems,
          },
          {
            preferCache,
          }
        )
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

    if (finalStatus === "pending_classification") {
      await createClassificationNotification(reservationId, transaction);
    }
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
    include: [reservationCargoItemsInclude],
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

export async function listPendingClassificationReservations(
  operatorUser: UserDTO,
  filters: ListReservationsQueryDTO
): Promise<PaginatedResult<ReservationDTO>> {
  assertOperator(operatorUser);
  return listReservations(operatorUser, { ...filters, status: "pending_classification" });
}

export async function listClassificationNotifications(
  operatorUser: UserDTO
): Promise<NotificationDTO[]> {
  assertOperator(operatorUser);

  const notifications = await NotificationModel.findAll({
    where: {
      type: "classification_required",
      status: "pending",
    },
    order: [["created_at", "DESC"]],
  });

  return notifications.map(modelToNotificationDTO);
}

export async function acknowledgeClassificationNotification(
  notificationId: string,
  operatorUser: UserDTO
): Promise<NotificationDTO> {
  assertOperator(operatorUser);

  const notification = await NotificationModel.findOne({
    where: {
      id: notificationId,
      type: "classification_required",
    },
  });

  if (!notification) {
    throw new HttpError(404, "Notification not found", "notification_not_found");
  }

  if (notification.status === "pending") {
    notification.status = "acknowledged";
    notification.acknowledgedAt = new Date();
    notification.acknowledgedByUserId = operatorUser.id;
    await notification.save();
  }

  return modelToNotificationDTO(notification);
}

export async function classifyReservationManually(
  reservationId: string,
  dto: ManualReservationClassificationDTO,
  operatorUser: UserDTO
): Promise<ReservationDTO> {
  assertOperator(operatorUser);

  const reservation = await loadReservationWithRelations(reservationId);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  ensurePendingClassification(reservation);
  assertUniqueCargoItemAssignments(dto);

  const cargoItems = sortCargoItemsByCreatedAt(reservation.cargoItems ?? []);
  if (cargoItems.length === 0) {
    throw new HttpError(409, "Reservation has no cargo items", "invalid_reservation_state");
  }

  const requestedCategoryIds = [...new Set(dto.cargoItems.map(({ categoryId }) => categoryId))];
  const categories = await CategoryModel.findAll({
    where: {
      id: {
        [Op.in]: requestedCategoryIds,
      },
    },
  });

  if (categories.length !== requestedCategoryIds.length) {
    throw new HttpError(404, "Category not found", "category_not_found");
  }

  const cargoItemById = new Map(cargoItems.map((cargoItem) => [cargoItem.id, cargoItem]));
  for (const assignment of dto.cargoItems) {
    const cargoItem = cargoItemById.get(assignment.cargoItemId);
    if (!cargoItem) {
      throw new HttpError(404, "Cargo item not found in reservation", "cargo_item_not_found");
    }
    cargoItem.categoryId = assignment.categoryId;
  }

  if (cargoItems.some((cargoItem) => cargoItem.categoryId === null)) {
    throw new HttpError(
      409,
      "All cargo items must be classified before quoting the reservation",
      "reservation_not_quotable"
    );
  }

  const quote = await quotePreparedReservation({
    origin: reservation.origin as GeoPoint,
    destination: reservation.destination as GeoPoint,
    cargoItems: cargoItems.map(mapCargoItemModelToPreparedCargoItem),
  });

  await sequelize.transaction(async (transaction) => {
    await Promise.all(cargoItems.map((cargoItem) => cargoItem.save({ transaction })));

    reservation.status = "pending_confirmation";
    reservation.quotedPrice = String(quote.quotedPrice);
    await reservation.save({ transaction });

    await acknowledgeNotification(reservation.id, operatorUser.id, transaction);
  });

  const updatedReservation = await loadReservationWithRelations(reservationId);
  if (!updatedReservation) {
    throw new HttpError(500, "Reservation update failed", "reservation_update_failed");
  }

  return mapReservationModelToDTO(
    updatedReservation,
    sortCargoItemsByCreatedAt(updatedReservation.cargoItems ?? [])
  );
}

export async function rejectReservation(
  reservationId: string,
  dto: RejectReservationDTO,
  operatorUser: UserDTO
): Promise<ReservationDTO> {
  assertOperator(operatorUser);

  const reservation = await loadReservationWithRelations(reservationId);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  ensurePendingClassification(reservation);

  const client = await getUser(reservation.clientId);

  await sequelize.transaction(async (transaction) => {
    reservation.status = "rejected";
    reservation.quotedPrice = null;
    reservation.rejectedAt = new Date();
    reservation.rejectedByUserId = operatorUser.id;
    reservation.rejectionReason = dto.reason;

    await reservation.save({ transaction });
    await acknowledgeNotification(reservation.id, operatorUser.id, transaction);

    if (client) {
      await enqueueOutboxEvent(
        {
          aggregateId: reservation.id,
          type: OUTBOX_EVENT_TYPES.reservationUnsupported,
          exchange: EXCHANGES.reservations,
          routingKey: ROUTING_KEYS.reservationUnsupported,
          payload: {
            reservationId: reservation.id,
            recipientEmail: client.email,
            recipientName: client.name,
            rejectionReason: dto.reason,
          },
        },
        transaction
      );
    }
  });

  if (!client) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "unsupported_reservation_email_client_missing",
        reservationId: reservation.id,
        clientId: reservation.clientId,
      })
    );
  }

  const updatedReservation = await loadReservationWithRelations(reservationId);
  if (!updatedReservation) {
    throw new HttpError(500, "Reservation update failed", "reservation_update_failed");
  }

  return mapReservationModelToDTO(
    updatedReservation,
    sortCargoItemsByCreatedAt(updatedReservation.cargoItems ?? [])
  );
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

// Size units: small/null=1, medium=2, large=3, extra_large=4. Used to check vehicle capacity.
function cargoSizeToUnits(size: string | null | undefined): number {
  if (!size || size.trim() === "" || size.trim().toLowerCase() === "small") return 1;
  switch (size.trim().toLowerCase()) {
    case "medium":
      return 2;
    case "large":
      return 3;
    case "extra_large":
      return 4;
    default:
      return 1;
  }
}

function calculateTotalCargoSize(items: CargoItemModel[]): number {
  return items.reduce((sum, item) => sum + cargoSizeToUnits(item.size), 0);
}

async function getVehicleById(id: string) {
  const vehicle = await VehicleReadModel.findByPk(id, {
    attributes: ["id", "status", "capacity"],
  });
  return vehicle;
}

const SCHEDULE_CONFLICT_WINDOW_MS = 2 * 60 * 60 * 1000; // ±2 hours

export async function assignReservation(
  reservationId: string,
  dto: AssignReservationDTO,
  _requestUser: UserDTO
): Promise<ReservationDTO> {
  const reservation = await loadReservationWithRelations(reservationId);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (reservation.status !== "confirmed") {
    throw new HttpError(
      409,
      "Reservation must be in 'confirmed' status to assign resources",
      "invalid_reservation_status"
    );
  }

  const vehicle = await getVehicleById(dto.vehicleId);
  if (!vehicle) {
    throw new HttpError(404, "Vehicle not found", "vehicle_not_found");
  }

  if (vehicle.status === "maintenance" || vehicle.status === "inactive") {
    throw new HttpError(409, "Vehicle is not available for assignment", "vehicle_unavailable");
  }

  const cargoItems = reservation.cargoItems ?? [];
  const totalSize = calculateTotalCargoSize(cargoItems);
  if (totalSize > vehicle.capacity) {
    throw new HttpError(
      409,
      `Vehicle capacity (${vehicle.capacity}) is insufficient for cargo size (${totalSize})`,
      "vehicle_capacity_exceeded"
    );
  }

  const driver = await getUser(dto.driverId);
  if (!driver) {
    throw new HttpError(404, "Driver not found", "driver_not_found");
  }
  if (driver.role !== "driver") {
    throw new HttpError(409, "User is not a driver", "user_not_driver");
  }
  if (driver.status !== "active") {
    throw new HttpError(409, "Driver is not active", "driver_not_active");
  }

  const conflictWindow = {
    [Op.between]: [
      new Date(reservation.scheduledAt.getTime() - SCHEDULE_CONFLICT_WINDOW_MS),
      new Date(reservation.scheduledAt.getTime() + SCHEDULE_CONFLICT_WINDOW_MS),
    ] as [Date, Date],
  };
  const conflictStatuses = ["confirmed", "assigned", "in_progress"];

  const vehicleConflict = await ReservationModel.findOne({
    where: {
      vehicleId: dto.vehicleId,
      id: { [Op.ne]: reservationId },
      status: { [Op.in]: conflictStatuses },
      scheduledAt: conflictWindow,
    },
  });
  if (vehicleConflict) {
    throw new HttpError(
      409,
      "Vehicle is already assigned to another reservation at this time",
      "vehicle_schedule_conflict"
    );
  }

  const driverConflict = await ReservationModel.findOne({
    where: {
      driverId: dto.driverId,
      id: { [Op.ne]: reservationId },
      status: { [Op.in]: conflictStatuses },
      scheduledAt: conflictWindow,
    },
  });
  if (driverConflict) {
    throw new HttpError(
      409,
      "Driver is already assigned to another reservation at this time",
      "driver_schedule_conflict"
    );
  }

  const categoryIds = [
    ...new Set(
      cargoItems
        .map((cargoItem) => cargoItem.categoryId)
        .filter((categoryId): categoryId is string => categoryId !== null)
    ),
  ];

  await sequelize.transaction(async (t) => {
    reservation.vehicleId = dto.vehicleId;
    reservation.driverId = dto.driverId;
    reservation.status = "assigned";
    await reservation.save({ transaction: t });

    await enqueueOutboxEvent(
      {
        aggregateId: reservationId,
        type: OUTBOX_EVENT_TYPES.reservationAssigned,
        exchange: EXCHANGES.reservations,
        routingKey: ROUTING_KEYS.reservationAssigned,
        payload: {
          reservationId,
          vehicleId: dto.vehicleId,
          driverId: dto.driverId,
          origin: reservation.origin,
          destination: reservation.destination,
          driverName: driver.name,
          driverEmail: driver.email,
          categoryIds,
        },
      },
      t
    );
  });

  const updated = await loadReservationWithRelations(reservationId);
  if (!updated) {
    throw new HttpError(500, "Reservation update failed", "reservation_update_failed");
  }
  const sortedItems = sortCargoItemsByCreatedAt(updated.cargoItems ?? []);
  return mapReservationModelToDTO(updated, sortedItems);
}

async function createClassificationNotification(
  reservationId: string,
  transaction: Transaction
): Promise<void> {
  await NotificationModel.create(
    {
      id: crypto.randomUUID(),
      reservationId,
      type: "classification_required",
      status: "pending",
    },
    { transaction }
  );
}

async function acknowledgeNotification(
  reservationId: string,
  operatorUserId: string,
  transaction: Transaction
): Promise<void> {
  const notification = await NotificationModel.findOne({
    where: {
      reservationId,
      type: "classification_required",
      status: "pending",
    },
    transaction,
  });

  if (!notification) {
    return;
  }

  notification.status = "acknowledged";
  notification.acknowledgedAt = new Date();
  notification.acknowledgedByUserId = operatorUserId;
  await notification.save({ transaction });
}

function assertOperator(user: UserDTO): void {
  if (user.role !== "operator") {
    throw new HttpError(403, "Only operators can perform this action", "forbidden");
  }
}

function ensurePendingClassification(reservation: ReservationModel): void {
  if (reservation.status !== "pending_classification") {
    throw new HttpError(
      409,
      `Reservation must be in 'pending_classification' status, current status is '${reservation.status}'`,
      "invalid_status_transition"
    );
  }
}

function assertUniqueCargoItemAssignments(dto: ManualReservationClassificationDTO): void {
  const uniqueAssignments = new Set(dto.cargoItems.map(({ cargoItemId }) => cargoItemId));
  if (uniqueAssignments.size !== dto.cargoItems.length) {
    throw new HttpError(
      400,
      "cargoItems cannot contain duplicated cargoItemId values",
      "invalid_reservation_classification"
    );
  }
}

function mapCargoItemModelToPreparedCargoItem(cargoItem: CargoItemModel): PreparedCargoItemInput {
  return {
    description: cargoItem.description,
    estimatedValue: cargoItem.estimatedValue !== null ? parseFloat(cargoItem.estimatedValue) : null,
    size: cargoItem.size,
    categoryId: cargoItem.categoryId,
  };
}
