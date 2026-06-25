import type { GpsSignalDTO } from "@move/shared";
import type { ISignalFilter } from "../filter.interface";
import { acquireAlertLock, createAlert } from "../../service";

const SPEED_LIMIT_KMH = 120;

export class SpeedingFilter implements ISignalFilter {
  readonly name = "speeding";

  async apply(signal: GpsSignalDTO): Promise<void> {
    if (signal.speed <= SPEED_LIMIT_KMH) return;

    const lockAcquired = await acquireAlertLock(signal.vehicleId, "speeding");
    if (!lockAcquired) return;

    await createAlert({
      vehicleId: signal.vehicleId,
      type: "speeding",
      severity: "critical",
      message: `Vehicle exceeding speed limit: ${signal.speed} km/h (limit: ${SPEED_LIMIT_KMH} km/h)`,
      location: signal.location,
    });

    console.warn(`[alerts] speeding alert for vehicle ${signal.vehicleId}: ${signal.speed} km/h`);
  }
}
