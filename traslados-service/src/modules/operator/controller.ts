import type { Request, Response } from "express";
import { getActiveTrips, reassignVehicle, getAvailableVehicles } from "./service";

export async function activeTripsHandler(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getActiveTrips() });
}

export async function availableVehiclesHandler(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await getAvailableVehicles() });
}

export async function reassignHandler(req: Request, res: Response): Promise<void> {
  const { tripId } = req.params as { tripId: string };
  const { vehicleId } = req.body as { vehicleId: string };
  const result = await reassignVehicle(tripId, vehicleId);
  if (!result) {
    res.status(404).json({ success: false, error: "Trip not found" });
    return;
  }
  res.json({ success: true, data: result });
}
