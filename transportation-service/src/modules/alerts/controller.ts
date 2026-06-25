import type { Request, Response } from "express";
import { listAlerts, resolveAlert } from "./service";

export async function listHandler(req: Request, res: Response): Promise<void> {
  try {
    const tripId = req.query["tripId"] as string | undefined;
    const vehicleId = req.query["vehicleId"] as string | undefined;
    const resolvedParam = req.query["resolved"] as string | undefined;
    const resolved =
      resolvedParam === "true" ? true : resolvedParam === "false" ? false : undefined;

    const filters: Parameters<typeof listAlerts>[0] = {};
    if (tripId !== undefined) filters.tripId = tripId;
    if (vehicleId !== undefined) filters.vehicleId = vehicleId;
    if (resolved !== undefined) filters.resolved = resolved;

    const data = await listAlerts(filters);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
}

export async function resolveHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const result = await resolveAlert(id);
    if (!result) {
      res.status(404).json({ success: false, error: "Alert not found or already resolved" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
}
