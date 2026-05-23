import { HttpError } from "@move/shared";
import type {
  CreateReservationDTO,
  GeoPoint,
  GoodDTO,
  ListReservationsQueryDTO,
  PaginatedResult,
  ReservationDTO,
  ReservationStatus,
  UserDTO,
} from "@move/shared";
import { Op, type WhereOptions } from "sequelize";
import { classifyGood } from "../../clients/categorizer";
import { GoodModel, ReservationModel } from "../../db/models";
import { sequelize } from "../../db/sequelize";

function modelToGoodDTO(row: GoodModel): GoodDTO {
  return {
    id: row.id,
    reservationId: row.reservationId,
    description: row.description,
    estimatedValue: row.estimatedValue !== null ? parseFloat(row.estimatedValue) : null,
    size: row.size,
    categoryId: row.categoryId,
  };
}

function modelToReservationDTO(row: ReservationModel, goods: GoodModel[]): ReservationDTO {
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
    paymentId: row.paymentId,
    goods: goods.map(modelToGoodDTO),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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

async function loadReservationWithGoods(id: string): Promise<ReservationModel | null> {
  return ReservationModel.findByPk(id, {
    include: [{ model: GoodModel, as: "goods" }],
  });
}

export async function createReservation(
  dto: CreateReservationDTO,
  clientUser: UserDTO
): Promise<ReservationDTO> {
  const scheduledAt = new Date(dto.scheduledAt);
  if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    throw new HttpError(400, "scheduledAt must be a future date", "invalid_scheduled_at");
  }

  if (dto.goods.length === 0) {
    throw new HttpError(400, "At least one good is required", "goods_required");
  }

  const categoryIds = await Promise.all(dto.goods.map((g) => classifyGood(g.description)));
  const allClassified = categoryIds.every((id) => id !== null);
  const status: ReservationStatus = allClassified ? "pending_quote" : "pending_classification";
  const reservationId = crypto.randomUUID();

  await sequelize.transaction(async (transaction) => {
    await ReservationModel.create(
      {
        id: reservationId,
        clientId: clientUser.id,
        origin: dto.origin,
        destination: dto.destination,
        scheduledAt,
        status,
      },
      { transaction }
    );

    await GoodModel.bulkCreate(
      dto.goods.map((good, index) => ({
        id: crypto.randomUUID(),
        reservationId,
        description: good.description,
        estimatedValue: good.estimatedValue ?? null,
        size: good.size ?? null,
        categoryId: categoryIds[index] ?? null,
      })),
      { transaction }
    );
  });

  const reservation = await loadReservationWithGoods(reservationId);
  if (!reservation) {
    throw new HttpError(500, "Reservation creation failed", "reservation_create_failed");
  }

  const goods = (reservation.goods ?? []).slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return modelToReservationDTO(reservation, goods);
}

export async function getReservation(id: string, clientUser: UserDTO): Promise<ReservationDTO> {
  const reservation = await loadReservationWithGoods(id);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (clientUser.role === "client" && reservation.clientId !== clientUser.id) {
    throw new HttpError(403, "Access denied", "forbidden");
  }

  const goods = (reservation.goods ?? []).slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return modelToReservationDTO(reservation, goods);
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
    where.scheduledAt = filters.scheduledFrom && filters.scheduledTo
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
    include: [{ model: GoodModel, as: "goods" }],
    distinct: true,
    order: [["createdAt", "DESC"]],
    limit: pageSize,
    offset,
  });

  const data = result.rows.map((reservation) => {
    const goods = (reservation.goods ?? [])
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return modelToReservationDTO(reservation, goods);
  });

  return { data, total: result.count, page, pageSize };
}

export async function cancelReservation(id: string, clientUser: UserDTO): Promise<ReservationDTO> {
  const reservation = await loadReservationWithGoods(id);
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

  const goods = (reservation.goods ?? []).slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return modelToReservationDTO(reservation, goods);
}
