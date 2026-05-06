import type { Request, Response } from "express";
import { listZones, getZone, createZone, updateZone, deleteZone } from "./service";
import type { ZoneDTO } from "@move/shared";

export async function listHandler(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await listZones() });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await getZone(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Zone not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function createHandler(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await createZone(req.body as Omit<ZoneDTO, "id">) });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await updateZone(id, req.body as Partial<Omit<ZoneDTO, "id">>);
  if (!result) {
    res.status(404).json({ success: false, error: "Zone not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  if (!(await deleteZone(id))) {
    res.status(404).json({ success: false, error: "Zone not found" });
    return;
  }
  res.status(204).end();
}
