import "dotenv/config";

process.on("uncaughtException", (err: Error) => {
  process.stderr.write(`[categorizer] uncaughtException: ${err.message}\n${err.stack ?? ""}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  process.stderr.write(`[categorizer] unhandledRejection: ${message}\n`);
});

import express from "express";
import { categorizerRouter } from "./router";
import {
  getSemanticSearchCacheStatus,
  warmSemanticSearchCache as warmSemanticSearchCacheService,
} from "./modules/semantic-search/service";

const app = express();
const PORT = process.env["PORT"] ?? "3003";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "categorizer-service",
    semanticSearchCache: getSemanticSearchCacheStatus(),
  });
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
