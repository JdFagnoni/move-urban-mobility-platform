import type { Request, Response } from "express";
import type {
  ClientType,
  ListUsersQueryDTO,
  UpdateUserDTO,
  UserRole,
  UserStatus,
} from "@move/shared";
import { getErrorMessage, getErrorStatus, getRequestContext } from "@move/shared";
import { recordAuditLog } from "../auth/audit";
import { deleteUser, getUser, listUsers, updateUser, updateUserStatus } from "./service";

function parsePage(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function isAdmin(req: Request): boolean {
  return req.authenticatedUser?.profile.role === "admin";
}

async function auditAccessDenied(req: Request, reason: string): Promise<void> {
  const current = req.authenticatedUser?.profile;
  await recordAuditLog({
    ...getRequestContext(req),
    eventType: "access_denied",
    decision: "denied",
    statusCode: 403,
    userId: current?.id,
    authSubject: current?.authSubject,
    email: current?.email,
    role: current?.role,
    clientType: current?.clientType,
    reason,
  });
}

function buildListFilters(req: Request): ListUsersQueryDTO {
  const filters: ListUsersQueryDTO = {};
  if (typeof req.query["role"] === "string") {
    filters.role = req.query["role"] as UserRole;
  }
  if (typeof req.query["status"] === "string") {
    filters.status = req.query["status"] as UserStatus;
  }
  if (typeof req.query["clientType"] === "string") {
    filters.clientType = req.query["clientType"] as ClientType;
  }
  if (typeof req.query["email"] === "string") {
    filters.email = req.query["email"];
  }
  const page = parsePage(req.query["page"]);
  if (page !== undefined) {
    filters.page = page;
  }
  const pageSize = parsePage(req.query["pageSize"]);
  if (pageSize !== undefined) {
    filters.pageSize = pageSize;
  }
  return filters;
}

function buildSelfUpdateDTO(body: Partial<UpdateUserDTO>): UpdateUserDTO {
  const dto: UpdateUserDTO = {};
  if (body.name !== undefined) {
    dto.name = body.name;
  }
  if (body.phone !== undefined) {
    dto.phone = body.phone;
  }
  if (body.documentType !== undefined) {
    dto.documentType = body.documentType;
  }
  if (body.documentNumber !== undefined) {
    dto.documentNumber = body.documentNumber;
  }
  if (body.companyName !== undefined) {
    dto.companyName = body.companyName;
  }
  if (body.taxId !== undefined) {
    dto.taxId = body.taxId;
  }
  return dto;
}

export async function listHandler(req: Request, res: Response): Promise<void> {
  try {
    const result = await listUsers(buildListFilters(req));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const current = req.authenticatedUser?.profile;
  if (!current) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  if (!isAdmin(req) && current.id !== id) {
    await auditAccessDenied(req, "Users can only read their own profile");
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  try {
    const result = await getUser(id);
    if (!result) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const current = req.authenticatedUser?.profile;
  if (!current) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  if (!isAdmin(req) && current.id !== id) {
    await auditAccessDenied(req, "Users can only update their own profile");
    res.status(403).json({ success: false, error: "Forbidden" });
    return;
  }

  try {
    const dto = isAdmin(req)
      ? (req.body as UpdateUserDTO)
      : buildSelfUpdateDTO(req.body as Partial<UpdateUserDTO>);
    const result = await updateUser(id, dto);
    if (!result) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    await recordAuditLog({
      ...getRequestContext(req),
      eventType: "profile_updated",
      decision: "success",
      statusCode: 200,
      userId: result.id,
      authSubject: result.authSubject,
      email: result.email,
      role: result.role,
      clientType: result.clientType,
      metadata: { changedBy: current.id },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function updateStatusHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const { status } = req.body as { status?: UserStatus };
  if (!status) {
    res.status(400).json({ success: false, error: "status is required" });
    return;
  }

  try {
    const result = await updateUserStatus(id, status);
    if (!result) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    await recordAuditLog({
      ...getRequestContext(req),
      eventType: "status_changed",
      decision: "success",
      statusCode: 200,
      userId: result.id,
      authSubject: result.authSubject,
      email: result.email,
      role: result.role,
      clientType: result.clientType,
      metadata: { status },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  try {
    const disabled = await deleteUser(id);
    if (!disabled) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    await recordAuditLog({
      ...getRequestContext(req),
      eventType: "status_changed",
      decision: "success",
      statusCode: 204,
      userId: id,
      metadata: { status: "disabled" },
    });

    res.status(204).end();
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
  }
}
