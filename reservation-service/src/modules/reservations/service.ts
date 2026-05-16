import type { CreateReservationDTO, ReservationDTO, PaginatedResult } from "@move/shared";
import { HttpError } from "@move/shared";

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// F4.1 – crear reserva
export async function createReservation(dto: CreateReservationDTO): Promise<ReservationDTO> {
  // TODO: validate zone, assign vehicle, persist to DB
  const reservation: ReservationDTO = {
    id: crypto.randomUUID(),
    ...dto,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  return reservation;
}

// F4.2 – obtener reserva
async function findReservation(id: string): Promise<ReservationDTO | null> {
  // TODO: fetch from DB
  void id;
  return null;
}

export async function getReservation(id: string): Promise<ReservationDTO> {
  const reservation = await findReservation(id);
  if (!reservation) {
    throw new HttpError(404, "Reservation not found", "reservation_not_found");
  }

  return reservation;
}

// F7 – listar reservas del cliente
export async function listClientReservations(
  clientId: string,
  page: unknown,
  pageSize: unknown
): Promise<PaginatedResult<ReservationDTO>> {
  const normalizedPage = parsePositiveInteger(page, 1);
  const normalizedPageSize = parsePositiveInteger(pageSize, 20);
  // TODO: fetch from DB with pagination
  void clientId;
  return { data: [], total: 0, page: normalizedPage, pageSize: normalizedPageSize };
}

// F6 – confirmar reserva
export async function confirmReservation(id: string): Promise<ReservationDTO> {
  // TODO: update status in DB
  void id;
  throw new HttpError(404, "Reservation not found", "reservation_not_found");
}

// F7 – cancelar reserva
export async function cancelReservation(id: string): Promise<ReservationDTO> {
  // TODO: update status in DB
  void id;
  throw new HttpError(404, "Reservation not found", "reservation_not_found");
}
