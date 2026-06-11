import type { Request, Response } from "express";
import { createTrip, listTrips, getTrip, startTrip, completeTrip } from "./service";
import { HttpError } from "@move/shared";
import type { CreateTripDTO } from "@move/shared";

export async function createHandler(req: Request, res: Response): Promise<void> {
  res.status(201).json({ success: true, data: await createTrip(req.body as CreateTripDTO) });
}

export async function listHandler(req: Request, res: Response): Promise<void> {
  const page = Number(req.query["page"] ?? 1);
  const pageSize = Number(req.query["pageSize"] ?? 20);
  res.json({ success: true, data: await listTrips(page, pageSize) });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await getTrip(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Trip not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function startHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const authSubject = req.headers["x-auth-subject"] as string | undefined;

  if (!authSubject) {
    res.status(401).json({ success: false, error: "Missing driver identity" });
    return;
  }

  try {
    const result = await startTrip(id, authSubject);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export async function completeHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const authSubject = req.headers["x-auth-subject"] as string | undefined;

  if (!authSubject) {
    res.status(401).json({ success: false, error: "Missing driver identity" });
    return;
  }

  try {
    const result = await completeTrip(id, authSubject);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}
