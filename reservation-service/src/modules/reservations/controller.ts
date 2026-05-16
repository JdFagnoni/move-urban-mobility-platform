import type { Request, Response } from "express";
import {
  createReservation,
  getReservation,
  listClientReservations,
  confirmReservation,
  cancelReservation,
} from "./service";
import type { CreateReservationDTO } from "@move/shared";
import { handleServiceError } from "../../http/handler";

export async function createHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () =>
    createReservation(req.body as CreateReservationDTO)
  );
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => getReservation(id));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function listByClientHandler(req: Request, res: Response): Promise<void> {
  const { clientId } = req.params as { clientId: string };
  const result = await handleServiceError(res, () =>
    listClientReservations(clientId, req.query["page"], req.query["pageSize"])
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function confirmHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => confirmReservation(id));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function cancelHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => cancelReservation(id));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}
