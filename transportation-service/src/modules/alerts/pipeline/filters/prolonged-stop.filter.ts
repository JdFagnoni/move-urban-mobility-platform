import type { GpsSignalDTO } from "@move/shared";
import { query } from "@move/shared";
import type { ISignalFilter } from "../filter.interface";
import { acquireAlertLock, createAlert } from "../../service";

const STOP_THRESHOLD_MS = 60_000;

export class ProlongedStopFilter implements ISignalFilter {
  readonly name = "prolonged-stop";

  async apply(signal: GpsSignalDTO): Promise<void> {
    if (signal.speed > 0) return;

    const result = await query<{ speed: number; timestamp: string }>(
      `SELECT speed, timestamp FROM gps_signals
       WHERE vehicle_id = $1
       ORDER BY timestamp DESC
       LIMIT 2`,
      [signal.vehicleId]
    );

    if (result.rows.length < 2) return;

    const [latest, previous] = result.rows;
    if (!latest || !previous || latest.speed > 0 || previous.speed > 0) return;

    const elapsed = new Date(signal.timestamp).getTime() - new Date(previous.timestamp).getTime();
    if (elapsed >= STOP_THRESHOLD_MS) {
      const lockAcquired = await acquireAlertLock(signal.vehicleId, "delay");
      if (lockAcquired) {
        await createAlert({
          vehicleId: signal.vehicleId,
          type: "delay",
          severity: "warning",
          message: `Vehicle has been stopped for over ${Math.round(elapsed / 1000)}s`,
          location: signal.location,
        });
        console.warn(`[alerts] stop alert for vehicle ${signal.vehicleId}`);
      }
    }
  }
}
