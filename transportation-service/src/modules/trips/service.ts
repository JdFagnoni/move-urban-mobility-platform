import type { CreateTripDTO, TripDTO, PaginatedResult } from "@move/shared";

// F13 – crear traslado a partir de reserva
export async function createTrip(dto: CreateTripDTO): Promise<TripDTO> {
  return {
    id: crypto.randomUUID(),
    ...dto,
    status: "assigned",
    route: [],
  };
}

// F17 – listar traslados
export async function listTrips(
  page: number,
  pageSize: number
): Promise<PaginatedResult<TripDTO>> {
  return { data: [], total: 0, page, pageSize };
}

// F18 – obtener traslado
export async function getTrip(id: string): Promise<TripDTO | null> {
  void id;
  return null;
}

// F17 – iniciar traslado
export async function startTrip(id: string): Promise<TripDTO | null> {
  void id;
  return null;
}

// F18 – completar traslado
export async function completeTrip(id: string): Promise<TripDTO | null> {
  void id;
  return null;
}
