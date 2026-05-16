import type { Request, Response } from "express";
import type {
  AuthAuditEventType,
  ListAuthAuditLogsQueryDTO,
  RegisterClientDTO,
} from "@move/shared";
import { getErrorMessage, getErrorStatus, getRequestContext } from "@move/shared";
import { registerClient } from "./service";
import { listAuditLogs } from "./audit";

function parsePage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function registerHandler(req: Request, res: Response): Promise<void> {
  try {
    const dto = req.body as RegisterClientDTO;
    const user = await registerClient(dto, getRequestContext(req));
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const user = req.authenticatedUser?.profile;
  if (!user) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  res.json({ success: true, data: { user } });
}

export async function listAuditLogsHandler(req: Request, res: Response): Promise<void> {
  try {
    const filters: ListAuthAuditLogsQueryDTO = {};
    if (typeof req.query["eventType"] === "string") {
      filters.eventType = req.query["eventType"] as AuthAuditEventType;
    }
    if (typeof req.query["email"] === "string") {
      filters.email = req.query["email"];
    }
    if (typeof req.query["userId"] === "string") {
      filters.userId = req.query["userId"];
    }
    if (typeof req.query["from"] === "string") {
      filters.from = req.query["from"];
    }
    if (typeof req.query["to"] === "string") {
      filters.to = req.query["to"];
    }
    const page = parsePage(req.query["page"]);
    if (page !== undefined) {
      filters.page = page;
    }
    const pageSize = parsePage(req.query["pageSize"]);
    if (pageSize !== undefined) {
      filters.pageSize = pageSize;
    }
    const result = await listAuditLogs(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}
