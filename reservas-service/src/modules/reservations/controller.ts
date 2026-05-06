import type { Request, Response } from "express";
import {
  createReservation,
  getReservation,
  listPassengerReservations,
  confirmReservation,
  cancelReservation,
} from "./service";
import type { CreateReservationDTO } from "@move/shared";

export async function createHandler(req: Request, res: Response): Promise<void> {
  const dto = req.body as CreateReservationDTO;
  const result = await createReservation(dto);
  res.status(201).json({ success: true, data: result });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await getReservation(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Reservation not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function listByPassengerHandler(req: Request, res: Response): Promise<void> {
  const { passengerId } = req.params as { passengerId: string };
  const page = Number(req.query["page"] ?? 1);
  const pageSize = Number(req.query["pageSize"] ?? 20);
  const result = await listPassengerReservations(passengerId, page, pageSize);
  res.json({ success: true, data: result });
}

export async function confirmHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await confirmReservation(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Reservation not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function cancelHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await cancelReservation(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Reservation not found" });
    return;
  }
  res.json({ success: true, data: result });
}
