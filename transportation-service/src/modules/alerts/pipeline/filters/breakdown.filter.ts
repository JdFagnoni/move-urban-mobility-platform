import type { GpsSignalDTO } from "@move/shared";
import { query } from "@move/shared";
import type { ISignalFilter } from "../filter.interface";
import { acquireAlertLock, createAlert } from "../../service";

const BREAKDOWN_STOP_THRESHOLD_MS = 120_000; // 2 minutes stopped during an active trip

export class BreakdownFilter implements ISignalFilter {
  readonly name = "breakdown";

  async apply(signal: GpsSignalDTO): Promise<void> {
    // Only trigger for stopped vehicles
    if (signal.speed > 0) return;

    // Only trigger if there is an active trip for this vehicle
    const tripResult = await query<{ id: string }>(
      `SELECT id FROM trips WHERE vehicle_id = $1 AND status = 'in_progress' LIMIT 1`,
      [signal.vehicleId]
    );
    if ((tripResult.rowCount ?? 0) === 0) return;

    // Check how long the vehicle has been stopped
    const signalResult = await query<{ speed: number; timestamp: string }>(
      `SELECT speed, timestamp FROM gps_signals
       WHERE vehicle_id = $1
       ORDER BY timestamp DESC
       LIMIT 2`,
      [signal.vehicleId]
    );

    if (signalResult.rows.length < 2) return;

    const [latest, previous] = signalResult.rows;
    if (!latest || !previous || latest.speed > 0 || previous.speed > 0) return;

    const elapsed = new Date(signal.timestamp).getTime() - new Date(previous.timestamp).getTime();
    if (elapsed < BREAKDOWN_STOP_THRESHOLD_MS) return;

    const lockAcquired = await acquireAlertLock(signal.vehicleId, "breakdown");
    if (!lockAcquired) return;

    await createAlert({
      vehicleId: signal.vehicleId,
      type: "breakdown",
      severity: "critical",
      message: `Vehicle breakdown detected: stopped for over ${Math.round(elapsed / 1000)}s during active trip`,
      location: signal.location,
    });

    console.warn(`[alerts] breakdown alert for vehicle ${signal.vehicleId}`);
  }
}
