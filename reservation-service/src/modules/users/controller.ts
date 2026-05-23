import type { Request, Response } from "express";
import type { UpdateUserDTO } from "@move/shared";
import { getRequestContext } from "@move/shared";
import { handleServiceError } from "../../http/handler";
import {
  deleteUserForHttp,
  getUserProfile,
  listUsersForHttp,
  updateUserProfile,
  updateUserStatusForHttp,
} from "./service";

export async function listHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () =>
    listUsersForHttp({
      role: req.query["role"],
      status: req.query["status"],
      clientType: req.query["clientType"],
      email: req.query["email"],
      page: req.query["page"],
      pageSize: req.query["pageSize"],
    })
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    getUserProfile({
      id,
      currentUser: req.authenticatedUser?.profile,
      context: getRequestContext(req),
    })
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    updateUserProfile({
      id,
      dto: req.body as Partial<UpdateUserDTO>,
      currentUser: req.authenticatedUser?.profile,
      context: getRequestContext(req),
    })
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () =>
    updateUserStatusForHttp({
      id,
      status: (req.body as { status?: unknown }).status,
      context: getRequestContext(req),
    })
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => deleteUserForHttp(id, getRequestContext(req)));
  if (!result.ok) {
    return;
  }

  res.status(204).end();
}
