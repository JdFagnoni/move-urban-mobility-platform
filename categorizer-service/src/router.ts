import { Router } from "express";
import type { Request, Response } from "express";
import { classifyWithGenerativeAi } from "./strategies/generative-ai/strategy";
import { classifyWithSemanticSearch } from "./strategies/semantic-search/strategy";
import { classifyWithKeyword } from "./strategies/keyword/strategy";
import type { CategoryDTO } from "@move/shared";

export interface ClassifyRequest {
  description: string;
  availableCategories: CategoryDTO[];
}

export const categorizerRouter = Router();

// Tries strategies in order: generative-ai → semantic-search → keyword
categorizerRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { description, availableCategories } = req.body as ClassifyRequest;

  if (!description || !Array.isArray(availableCategories)) {
    res
      .status(400)
      .json({ success: false, error: "description and availableCategories are required" });
    return;
  }

  const input = { description, availableCategories };

  const categoryId =
    (await classifyWithGenerativeAi(input)) ??
    (await classifyWithSemanticSearch(input)) ??
    classifyWithKeyword(input);

  if (!categoryId) {
    res.status(422).json({ success: false, error: "Could not classify request" });
    return;
  }

  res.json({ success: true, data: { categoryId } });
});
