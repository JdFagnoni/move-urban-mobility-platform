import type { GpsSignalDTO } from "@move/shared";
import { query } from "@move/shared";
import type { ISignalFilter } from "../filter.interface";
import { createAlert, hasActiveAlert } from "../../service";

interface ZoneRow {
  id: string;
  name: string;
  type: string;
  polygon: { type: "Polygon"; coordinates: number[][][] };
}

function pointInPolygon(point: [number, number], ring: number[][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export class GeofenceFilter implements ISignalFilter {
  readonly name = "geofence";

  async apply(signal: GpsSignalDTO): Promise<void> {
    const zones = await query<ZoneRow>(
      "SELECT id, name, type, polygon FROM zones WHERE type = 'red' AND active = true"
    );

    for (const zone of zones.rows) {
      const ring = zone.polygon.coordinates[0];
      if (!ring) continue;
      const inside = pointInPolygon(signal.location.coordinates, ring);
      if (inside) {
        const alreadyAlerted = await hasActiveAlert(signal.vehicleId, "geofence_exit");
        if (!alreadyAlerted) {
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
