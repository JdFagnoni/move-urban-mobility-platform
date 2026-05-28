import type { Request, Response } from "express";
import { handleServiceError } from "../../http/handler";
import type { ListVehiclesFilters } from "./service";
import {
  createVehicle,
  deleteVehicle,
  getVehicleForHttp,
  listVehicles,
  updateVehicle,
} from "./service";
import type { VehicleDTO, VehicleStatus } from "@move/shared";

export async function listHandler(req: Request, res: Response): Promise<void> {
  const filters: ListVehiclesFilters = {};
  const statusParam = req.query["status"] as string | undefined;
  const typeParam = req.query["type"] as string | undefined;
  if (statusParam) filters.status = statusParam as VehicleStatus;
  if (typeParam) filters.type = typeParam;

  const result = await handleServiceError(res, () => listVehicles(filters));
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

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => deleteVehicle(id));
  if (!result.ok) {
    return;
  }
  res.status(204).end();
}
