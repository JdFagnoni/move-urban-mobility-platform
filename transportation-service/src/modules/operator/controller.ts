import type { Request, Response } from "express";
import { HttpError } from "@move/shared";
import { getActiveTrips, reassignVehicle, getAvailableVehicles } from "./service";
import type { ActiveTripFilters } from "./service";

export async function activeTripsHandler(req: Request, res: Response): Promise<void> {
  const authSubject = req.headers["x-auth-subject"] as string | undefined;
  if (!authSubject) {
    res.status(401).json({ success: false, error: "Missing operator identity" });
    return;
  }

  const filters: ActiveTripFilters = {};
  const vehicleId = req.query["vehicleId"] as string | undefined;
  const driverId = req.query["driverId"] as string | undefined;
  const categoryId = req.query["categoryId"] as string | undefined;
  const hasActiveAlertsParam = req.query["hasActiveAlerts"] as string | undefined;

  if (vehicleId !== undefined) filters.vehicleId = vehicleId;
  if (driverId !== undefined) filters.driverId = driverId;
  if (categoryId !== undefined) filters.categoryId = categoryId;
  if (hasActiveAlertsParam === "true") filters.hasActiveAlerts = true;
  else if (hasActiveAlertsParam === "false") filters.hasActiveAlerts = false;

  try {
    const data = await getActiveTrips(authSubject, filters);
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: "Internal server error" });
  }
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
