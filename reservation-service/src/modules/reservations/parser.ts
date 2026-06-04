import { HttpError } from "@move/shared";
import type { AssignReservationDTO } from "@move/shared";

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
