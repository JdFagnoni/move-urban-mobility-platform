import type { Request, Response } from "express";
import { getMetricsSnapshot } from "@move/shared";
import { getAlertsByType, getGpsSignalsIngestedCount } from "./service";

export async function getMetricsHandler(_req: Request, res: Response): Promise<void> {
  const [alertsByType, gpsSignalsIngested] = await Promise.all([
    getAlertsByType(),
    getGpsSignalsIngestedCount(),
  ]);
  res.json({ ...getMetricsSnapshot(), alertsByType, gpsSignalsIngested });
}
