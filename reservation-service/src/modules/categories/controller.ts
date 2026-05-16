import type { Request, Response } from "express";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./service";
import type { CategoryDTO } from "@move/shared";

export async function listHandler(_req: Request, res: Response): Promise<void> {
  res.json({ success: true, data: await listCategories() });
}

export async function getHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await getCategory(id);
  if (!result) {
    res.status(404).json({ success: false, error: "Category not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function createHandler(req: Request, res: Response): Promise<void> {
  const dto = req.body as Omit<CategoryDTO, "id">;
  res.status(201).json({ success: true, data: await createCategory(dto) });
}

export async function updateHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const result = await updateCategory(id, req.body as Partial<Omit<CategoryDTO, "id">>);
  if (!result) {
    res.status(404).json({ success: false, error: "Category not found" });
    return;
  }
  res.json({ success: true, data: result });
}

export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const ok = await deleteCategory(id);
  if (!ok) {
    res.status(404).json({ success: false, error: "Category not found" });
    return;
  }
  res.status(204).end();
}
