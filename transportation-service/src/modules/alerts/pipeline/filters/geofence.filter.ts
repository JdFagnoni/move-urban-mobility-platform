import type { GpsSignalDTO } from "@move/shared";
import type { ISignalFilter } from "../filter.interface";
import { acquireAlertLock, createAlert } from "../../service";
import { ZoneModel } from "../../../../db/models";
import { pointInPolygon } from "../../../zones/geo";

export class GeofenceFilter implements ISignalFilter {
  readonly name = "geofence";

  async apply(signal: GpsSignalDTO): Promise<void> {
    const zones = await ZoneModel.findAll({
      where: { type: "red", active: true },
      attributes: ["id", "name", "type", "polygon"],
    });

    for (const zone of zones) {
      const ring = zone.polygon.coordinates[0];
      if (!ring) continue;
      const inside = pointInPolygon(signal.location.coordinates, ring);
      if (inside) {
        const lockAcquired = await acquireAlertLock(signal.vehicleId, "geofence_exit");
        if (lockAcquired) {
          await createAlert({
            vehicleId: signal.vehicleId,
            type: "geofence_exit",
            severity: "critical",
            message: `Vehicle entered red zone "${zone.name}"`,
            location: signal.location,
          });
          console.warn(
            `[alerts] geofence alert for vehicle ${signal.vehicleId} in zone "${zone.name}"`
          );
        }
        return;
      }
    }
  }
}
