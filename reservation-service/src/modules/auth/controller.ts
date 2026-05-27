import type { Request, Response } from "express";
import { getRequestContext } from "@move/shared";
import { handleServiceError } from "../../http/handler";
import { getAuthenticatedProfile, listAuthAuditLogsForHttp, registerClientForHttp } from "./service";

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () =>
    registerClientForHttp(req.body, getRequestContext(req))
  );
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () =>
    getAuthenticatedProfile(req.authenticatedUser?.profile)
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function listAuditLogsHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () =>
    listAuthAuditLogsForHttp({
      eventType: req.query["eventType"],
      email: req.query["email"],
      userId: req.query["userId"],
      from: req.query["from"],
      to: req.query["to"],
      page: req.query["page"],
      pageSize: req.query["pageSize"],
    })
  );
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}
