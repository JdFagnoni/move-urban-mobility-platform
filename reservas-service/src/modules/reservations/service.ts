import type {
  CreateReservationDTO,
  ReservationDTO,
  PaginatedResult,
} from "@move/shared";

// F4.1 – crear reserva
export async function createReservation(
  dto: CreateReservationDTO
): Promise<ReservationDTO> {
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
export async function getReservation(id: string): Promise<ReservationDTO | null> {
  // TODO: fetch from DB
  void id;
  return null;
}

// F5 – listar reservas del pasajero
export async function listPassengerReservations(
  passengerId: string,
  page: number,
  pageSize: number
): Promise<PaginatedResult<ReservationDTO>> {
  // TODO: fetch from DB with pagination
  void passengerId;
  return { data: [], total: 0, page, pageSize };
}

// F6 – confirmar reserva
export async function confirmReservation(id: string): Promise<ReservationDTO | null> {
  // TODO: update status in DB
  void id;
  return null;
}

// F7 – cancelar reserva
export async function cancelReservation(id: string): Promise<ReservationDTO | null> {
  // TODO: update status in DB
  void id;
  return null;
}
