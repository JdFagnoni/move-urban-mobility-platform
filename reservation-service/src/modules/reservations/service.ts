import { pool, query, HttpError } from "@move/shared";
import type {
  CreateReservationDTO,
  ReservationDTO,
  GoodDTO,
  ListReservationsQueryDTO,
  PaginatedResult,
  UserDTO,
  ReservationStatus,
  GeoPoint,
} from "@move/shared";
import { classifyGood } from "../../clients/categorizer";

interface ReservationRow {
  id: string;
  client_id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  scheduled_at: Date;
  status: ReservationStatus;
  quoted_price: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  payment_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface GoodRow {
  id: string;
  reservation_id: string;
  description: string;
  estimated_value: string | null;
  size: string | null;
  category_id: string | null;
}

function rowToGoodDTO(row: GoodRow): GoodDTO {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    description: row.description,
    estimatedValue: row.estimated_value !== null ? parseFloat(row.estimated_value) : null,
    size: row.size,
    categoryId: row.category_id,
  };
}

function rowToReservationDTO(row: ReservationRow, goods: GoodRow[]): ReservationDTO {
  return {
    id: row.id,
    clientId: row.client_id,
    origin: row.origin,
    destination: row.destination,
    scheduledAt: row.scheduled_at.toISOString(),
    status: row.status,
    quotedPrice: row.quoted_price !== null ? parseFloat(row.quoted_price) : null,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    paymentId: row.payment_id,
    goods: goods.map(rowToGoodDTO),
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

async function fetchGoodsForReservation(reservationId: string): Promise<GoodRow[]> {
  const result = await query<GoodRow>(
    "SELECT * FROM goods WHERE reservation_id = $1 ORDER BY created_at",
    [reservationId]
  );
  return result.rows;
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

  const dbClient = await pool.connect();
  try {
    await dbClient.query("BEGIN");

    const reservationId = crypto.randomUUID();
    await dbClient.query(
      `INSERT INTO reservations (id, client_id, origin, destination, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reservationId,
        clientUser.id,
        JSON.stringify(dto.origin),
        JSON.stringify(dto.destination),
        scheduledAt.toISOString(),
        status,
      ]
    );

    const classifiedGoods = dto.goods.map((good, i) => ({
      good,
      categoryId: categoryIds[i] ?? null,
    }));

    const insertedGoodRows: GoodRow[] = [];

    for (const { good, categoryId } of classifiedGoods) {
      const goodId = crypto.randomUUID();
      await dbClient.query(
        `INSERT INTO goods (id, reservation_id, description, estimated_value, size, category_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          goodId,
          reservationId,
          good.description,
          good.estimatedValue ?? null,
          good.size ?? null,
          categoryId,
        ]
      );
      insertedGoodRows.push({
        id: goodId,
        reservation_id: reservationId,
        description: good.description,
        estimated_value: good.estimatedValue !== undefined ? String(good.estimatedValue) : null,
        size: good.size ?? null,
        category_id: categoryId,
      });
    }

    await dbClient.query("COMMIT");

    const now = new Date();
    const reservationRow: ReservationRow = {
      id: reservationId,
      client_id: clientUser.id,
      origin: dto.origin,
      destination: dto.destination,
      scheduled_at: scheduledAt,
      status,
      quoted_price: null,
      vehicle_id: null,
      driver_id: null,
      payment_id: null,
      created_at: now,
      updated_at: now,
    };

    return rowToReservationDTO(reservationRow, insertedGoodRows);
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
}

export async function getReservation(id: string, clientUser: UserDTO): Promise<ReservationDTO> {
  const result = await query<ReservationRow>(
    "SELECT * FROM reservations WHERE id = $1",
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (clientUser.role === "client" && row.client_id !== clientUser.id) {
    throw new HttpError(403, "Access denied", "forbidden");
  }

  const goods = await fetchGoodsForReservation(id);
  return rowToReservationDTO(row, goods);
}

export async function listReservations(
  clientUser: UserDTO,
  filters: ListReservationsQueryDTO
): Promise<PaginatedResult<ReservationDTO>> {
  const page = parsePositiveInteger(filters.page, 1);
  const pageSize = parsePositiveInteger(filters.pageSize, 20);
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (clientUser.role === "client") {
    params.push(clientUser.id);
    conditions.push(`client_id = $${params.length}`);
  }

  if (filters.scheduledFrom) {
    params.push(filters.scheduledFrom);
    conditions.push(`scheduled_at >= $${params.length}`);
  }

  if (filters.scheduledTo) {
    params.push(filters.scheduledTo);
    conditions.push(`scheduled_at <= $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM reservations ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

  const listParams = [...params, pageSize, offset];
  const limitIdx = listParams.length - 1;
  const offsetIdx = listParams.length;

  const reservationsResult = await query<ReservationRow>(
    `SELECT * FROM reservations ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams
  );

  const data = await Promise.all(
    reservationsResult.rows.map(async (row) => {
      const goods = await fetchGoodsForReservation(row.id);
      return rowToReservationDTO(row, goods);
    })
  );

  return { data, total, page, pageSize };
}

export async function cancelReservation(id: string, clientUser: UserDTO): Promise<ReservationDTO> {
  const result = await query<ReservationRow>(
    "SELECT * FROM reservations WHERE id = $1",
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  if (clientUser.role === "client" && row.client_id !== clientUser.id) {
    throw new HttpError(403, "Access denied", "forbidden");
  }

  if (!CANCELLABLE_STATUSES.includes(row.status)) {
    throw new HttpError(
      409,
      `Cannot cancel a reservation with status '${row.status}'`,
      "invalid_status_transition"
    );
  }

  await query(
    "UPDATE reservations SET status = 'cancelled', updated_at = now() WHERE id = $1",
    [id]
  );

  const goods = await fetchGoodsForReservation(id);
  return rowToReservationDTO(
    { ...row, status: "cancelled", updated_at: new Date() },
    goods
  );
}
