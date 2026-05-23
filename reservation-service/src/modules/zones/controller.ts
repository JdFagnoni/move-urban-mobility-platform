import type { Request, Response } from "express";
import { handleServiceError } from "../../http/handler";
import { createZone, deleteZone, getZoneForHttp, listZones, updateZone } from "./service";
import type { ZoneDTO } from "@move/shared";

export async function listHandler(_req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () => listZones());
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => getZoneForHttp(id));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function createHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () => createZone(req.body as Omit<ZoneDTO, "id">));
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    updateZone(id, req.body as Partial<Omit<ZoneDTO, "id">>)
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => deleteZone(id));
  if (!result.ok) {
    return;
  }

  res.status(204).end();
}
