import type { Request, Response } from "express";
import { createReservation, getReservation, listReservations, cancelReservation } from "./service";
import type { CreateReservationDTO } from "@move/shared";
import { handleServiceError } from "../../http/handler";
import { parseListReservationsQuery } from "./parser";

export async function createHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const result = await handleServiceError(res, () =>
    createReservation(req.body as CreateReservationDTO, clientUser)
  );
  if (!result.ok) {
    return;
  }
  res.status(201).json({ success: true, data: result.data });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => getReservation(id, clientUser));
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}

export async function listHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const filters = parseListReservationsQuery(req.query);
  const result = await handleServiceError(res, () => listReservations(clientUser, filters));
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}

export async function cancelHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => cancelReservation(id, clientUser));
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}
