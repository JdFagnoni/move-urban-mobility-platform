import "dotenv/config";
import express from "express";
import { loadActiveCategories } from "./categories";
import { categorizerRouter } from "./router";
import { warmSemanticSearchCategories } from "./strategies/semantic-search/strategy";

const app = express();
const PORT = process.env["PORT"] ?? "3003";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "categorizer-service" });
});

app.use("/categorize", categorizerRouter);

app.listen(Number(PORT), () => {
  console.log(`categorizer-service running on port ${PORT}`);
  void warmSemanticSearchCache();
});

async function warmSemanticSearchCache(): Promise<void> {
  const startedAt = Date.now();

  try {
    const categories = await loadActiveCategories();
    if (categories.length === 0) {
      console.warn("categorizer-service semantic cache warmup skipped: no active categories");
      return;
    }

    await warmSemanticSearchCategories(categories);
    console.log(
      `categorizer-service semantic cache warmed for ${categories.length} categories in ${Date.now() - startedAt}ms`
    );
  } catch (error) {
    console.warn(
      `categorizer-service semantic cache warmup failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
