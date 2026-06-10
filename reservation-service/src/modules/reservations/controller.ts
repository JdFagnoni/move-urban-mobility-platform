import type { Request, Response } from "express";
import {
  acknowledgeClassificationNotification,
  assignReservation,
  cancelReservation,
  classifyReservationManually,
  createReservation,
  getReservation,
  listClassificationNotifications,
  listPendingClassificationReservations,
  listReservations,
  rejectReservation,
} from "./service";
import type { CreateReservationDTO } from "@move/shared";
import { handleServiceError } from "../../http/handler";
import {
  parseAssignReservationDTO,
  parseListReservationsQuery,
  parseManualReservationClassification,
  parseRejectReservation,
} from "./parser";

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
  const result = await handleServiceError(res, () => {
    const filters = parseListReservationsQuery(req.query);
    return listReservations(clientUser, filters);
  });
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}

export async function listPendingClassificationHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const result = await handleServiceError(res, () => {
    const filters = parseListReservationsQuery(req.query);
    return listPendingClassificationReservations(clientUser, filters);
  });
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}

export async function listClassificationNotificationsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const result = await handleServiceError(res, () => listClassificationNotifications(clientUser));
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}

export async function acknowledgeClassificationNotificationHandler(
  req: Request,
  res: Response
): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const { notificationId } = req.params as { notificationId: string };
  const result = await handleServiceError(res, () =>
    acknowledgeClassificationNotification(notificationId, clientUser)
  );
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

export async function assignHandler(req: Request, res: Response): Promise<void> {
  const user = req.authenticatedUser?.profile;
  if (!user) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    assignReservation(id, parseAssignReservationDTO(req.body), user)
  );
  if (!result.ok) return;
  res.json({ success: true, data: result.data });
}

export async function classifyReservationHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    classifyReservationManually(id, parseManualReservationClassification(req.body), clientUser)
  );
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}

export async function rejectReservationHandler(req: Request, res: Response): Promise<void> {
  const clientUser = req.authenticatedUser!.profile;
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    rejectReservation(id, parseRejectReservation(req.body), clientUser)
  );
  if (!result.ok) {
    return;
  }
  res.json({ success: true, data: result.data });
}
