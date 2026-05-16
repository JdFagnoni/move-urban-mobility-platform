import type { Request, Response } from "express";
import { listVehicles, getVehicle, createVehicle, updateVehicle } from "./service";
import type { VehicleDTO, VehicleStatus } from "@move/shared";

export async function listHandler(req: Request, res: Response): Promise<void> {
  const status = req.query["status"] as VehicleStatus | undefined;
  res.json({ success: true, data: await listVehicles(status) });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await getVehicle(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Vehicle not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function createHandler(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await createVehicle(req.body as Omit<VehicleDTO, "id">) });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await updateVehicle(id, req.body as Partial<Omit<VehicleDTO, "id">>);
  if (!result) {
    res.status(404).json({ success: false, error: "Vehicle not found" });
    return;
  }
  res.json({ success: true, data: result });
}
