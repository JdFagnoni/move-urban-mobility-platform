import { Router } from "express";
import type { Request, Response } from "express";
import { classifyDescription } from "./modules/semantic-search/service";

export interface ClassifyRequest {
  description: string;
}

export const categorizerRouter = Router();

// Production categorization uses the R10-selected semantic-search strategy only.
categorizerRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { description } = req.body as ClassifyRequest;

  if (typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ success: false, error: "description is required" });
    return;
  }

  try {
    const categoryId = await classifyDescription(description);
    if (!categoryId) {
      res.status(422).json({ success: false, error: "Could not classify request" });
      return;
    }

    res.json({ success: true, data: { categoryId } });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error instanceof Error ? error.message : "Could not classify request",
    });
  }
});
