import type { Request, Response } from "express";
import { ingestSignal, getLatestSignal, getAllLatestSignals } from "./service";
import type { GpsSignalDTO } from "@move/shared";

export async function ingestHandler(req: Request, res: Response): Promise<void> {
  try {
    await ingestSignal(req.body as GpsSignalDTO);
    res.status(202).json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: (err as Error).message });
  }
}

export async function latestHandler(req: Request, res: Response): Promise<void> {
  const { vehicleId } = req.params as { vehicleId: string };
  const result = await getLatestSignal(vehicleId);
  if (!result) {
    res.status(404).json({ success: false, error: "No GPS signal found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function allLatestHandler(_req: Request, res: Response): Promise<void> {
  const signals = await getAllLatestSignals();
  res.json({ success: true, data: signals });
}
