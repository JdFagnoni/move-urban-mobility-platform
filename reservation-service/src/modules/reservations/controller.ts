import type { Request, Response } from "express";
import { createReservation, getReservation, listReservations, cancelReservation } from "./service";
import type { CreateReservationDTO, ListReservationsQueryDTO } from "@move/shared";
import { handleServiceError } from "../../http/handler";

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
  const filters: ListReservationsQueryDTO = {};
  if (typeof req.query["scheduledFrom"] === "string") filters.scheduledFrom = req.query["scheduledFrom"];
  if (typeof req.query["scheduledTo"] === "string") filters.scheduledTo = req.query["scheduledTo"];
  if (typeof req.query["status"] === "string") filters.status = req.query["status"] as ListReservationsQueryDTO["status"];
  if (typeof req.query["page"] === "string") filters.page = Number(req.query["page"]);
  if (typeof req.query["pageSize"] === "string") filters.pageSize = Number(req.query["pageSize"]);
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
