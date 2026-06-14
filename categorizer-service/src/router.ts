import { Router } from "express";
import type { Request, Response } from "express";
import { classifyWithSemanticSearch } from "./strategies/semantic-search/strategy";
import type { CategoryDTO } from "@move/shared";
import { loadActiveCategories } from "./categories";

export interface ClassifyRequest {
  description: string;
  availableCategories?: CategoryDTO[];
}

export const categorizerRouter = Router();

// Production categorization uses the R10-selected semantic-search strategy only.
categorizerRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { description, availableCategories } = req.body as ClassifyRequest;

  if (typeof description !== "string" || description.trim().length === 0) {
    res
      .status(400)
      .json({ success: false, error: "description is required" });
    return;
  }

  let categories: CategoryDTO[];

  try {
    categories = Array.isArray(availableCategories)
      ? availableCategories
      : await loadActiveCategories();
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error instanceof Error ? error.message : "Could not load categories",
    });
    return;
  }

  if (categories.length === 0) {
    res.status(503).json({ success: false, error: "No active categories available" });
    return;
  }

  const input = { description, availableCategories: categories };

  const categoryId = await classifyWithSemanticSearch(input);

  if (!categoryId) {
    res.status(422).json({ success: false, error: "Could not classify request" });
    return;
  }

  res.json({ success: true, data: { categoryId } });
});
