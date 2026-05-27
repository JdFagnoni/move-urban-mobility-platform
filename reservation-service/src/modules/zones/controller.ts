import type { Request, Response } from "express";
import { handleServiceError } from "../../http/handler";
import { parseCreateZoneDTO, parseUpdateZoneDTO } from "./parser";
import { createZone, deleteZone, getZoneForHttp, listZones, updateZone } from "./service";

export async function listHandler(req: Request, res: Response): Promise<void> {
  const type = typeof req.query["type"] === "string" ? req.query["type"] : undefined;
  const result = await handleServiceError(res, () => listZones(type));
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
  const result = await handleServiceError(res, () =>
    createZone(parseCreateZoneDTO(req.body))
  );
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    updateZone(id, parseUpdateZoneDTO(req.body))
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
