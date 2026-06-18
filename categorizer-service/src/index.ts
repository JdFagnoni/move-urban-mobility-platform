import "dotenv/config";
import express from "express";
import { getMetricsSnapshot, requestMetrics } from "@move/shared";
import { categorizerRouter } from "./router";
import {
  getSemanticSearchCacheStatus,
  warmSemanticSearchCache as warmSemanticSearchCacheService,
} from "./modules/semantic-search/service";

const app = express();
const PORT = process.env["PORT"] ?? "3003";

app.use(express.json());
app.use(requestMetrics);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "categorizer-service",
    semanticSearchCache: getSemanticSearchCacheStatus(),
  });
});

app.get("/metrics", (_req, res) => {
  res.json(getMetricsSnapshot());
});

app.use("/categorize", categorizerRouter);

app.listen(Number(PORT), () => {
  console.log(`categorizer-service running on port ${PORT}`);
  void warmSemanticSearchCacheOnStartup();
});

async function warmSemanticSearchCacheOnStartup(): Promise<void> {
  const startedAt = Date.now();

  try {
    await warmSemanticSearchCacheService();
    const cacheStatus = getSemanticSearchCacheStatus();
    console.log(
      `categorizer-service semantic cache warmed for ${cacheStatus.categoryCount} categories in ${Date.now() - startedAt}ms`
    );
  } catch (error) {
    console.warn(
      `categorizer-service semantic cache warmup failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
