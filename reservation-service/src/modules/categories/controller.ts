import type { Request, Response } from "express";
import {
  listCategories,
  getCategoryForHttp,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./service";
import { handleServiceError } from "../../http/handler";
import { parseCreateCategoryDTO, parseUpdateCategoryDTO } from "./parser";

export async function listHandler(_req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () => listCategories());
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => getCategoryForHttp(id));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function createHandler(req: Request, res: Response): Promise<void> {
  const result = await handleServiceError(res, () => createCategory(parseCreateCategoryDTO(req.body)));
  if (!result.ok) {
    return;
  }

  res.status(201).json({ success: true, data: result.data });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => updateCategory(id, parseUpdateCategoryDTO(req.body)));
  if (!result.ok) {
    return;
  }

  res.json({ success: true, data: result.data });
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await handleServiceError(res, () => deleteCategory(id));
  if (!result.ok) {
    return;
  }

  res.status(204).end();
}
