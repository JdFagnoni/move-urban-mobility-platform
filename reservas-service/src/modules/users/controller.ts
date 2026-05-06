import type { Request, Response } from "express";
import { listUsers, getUser, updateUser, deleteUser } from "./service";
import type { UserDTO } from "@move/shared";

export async function listHandler(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await listUsers() });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await getUser(id);
  if (!result) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await updateUser(id, req.body as Partial<Omit<UserDTO, "id" | "createdAt">>);
  if (!result) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  if (!(await deleteUser(id))) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.status(204).end();
}
