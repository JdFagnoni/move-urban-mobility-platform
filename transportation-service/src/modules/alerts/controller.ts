import type { Request, Response } from "express";
import { createAlert, listActiveAlerts, resolveAlert } from "./service";
import type { AlertDTO } from "@move/shared";

export async function createHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as Parameters<typeof createAlert>[0];
  res.status(201).json({ success: true, data: await createAlert(body) });
}

export async function listHandler(req: Request, res: Response): Promise<void> {
  const tripId = req.query["tripId"] as string | undefined;
  res.json({ success: true, data: await listActiveAlerts(tripId) });
}

export async function resolveHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await resolveAlert(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Alert not found" });
    return;
  }
  res.json({ success: true, data: result });
}
