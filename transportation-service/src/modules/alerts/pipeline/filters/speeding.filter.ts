import type { GpsSignalDTO } from "@move/shared";
import type { ISignalFilter } from "../filter.interface";
import { createAlert, hasActiveAlert } from "../../service";

const SPEED_LIMIT_KMH = 120;

export class SpeedingFilter implements ISignalFilter {
  readonly name = "speeding";

  async apply(signal: GpsSignalDTO): Promise<void> {
    if (signal.speed <= SPEED_LIMIT_KMH) return;

    const alreadyAlerted = await hasActiveAlert(signal.vehicleId, "speeding");
    if (alreadyAlerted) return;

    await createAlert({
      vehicleId: signal.vehicleId,
      type: "speeding",
      severity: "critical",
      message: `Vehicle exceeding speed limit: ${signal.speed} km/h (limit: ${SPEED_LIMIT_KMH} km/h)`,
      location: signal.location,
    });

    console.warn(
      `[alerts] speeding alert for vehicle ${signal.vehicleId}: ${signal.speed} km/h`
    );
  }
}
