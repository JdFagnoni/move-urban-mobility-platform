import type { Request, Response } from "express";
import { handleServiceError } from "../../http/handler";
import { createVehicle, getVehicleForHttp, listVehicles, updateVehicle } from "./service";
import type { VehicleDTO, VehicleStatus } from "@move/shared";

export async function listHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () =>
    listVehicles(req.query["status"] as VehicleStatus | undefined)
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => getVehicleForHttp(id));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function createHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () =>
    createVehicle(req.body as Omit<VehicleDTO, "id">)
  );
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    updateVehicle(id, req.body as Partial<Omit<VehicleDTO, "id">>)
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}
