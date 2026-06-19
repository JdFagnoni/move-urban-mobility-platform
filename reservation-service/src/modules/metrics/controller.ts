import type { Request, Response } from "express";
import { getMetricsSnapshot } from "@move/shared";
import { getReservationsByCategory } from "./service";

export async function getMetricsHandler(_req: Request, res: Response): Promise<void> {
  const reservationsByCategory = await getReservationsByCategory();
  res.json({ ...getMetricsSnapshot(), reservationsByCategory });
}
