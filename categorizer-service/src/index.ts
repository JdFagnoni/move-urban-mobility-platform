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
import {
  consume,
  getMetricsSnapshot,
  QUEUES,
  requestMetrics,
  startMessaging,
  type CategoryChangedEvent,
} from "@move/shared";
import { categorizerRouter } from "./router";
import {
  getSemanticSearchCacheStatus,
  warmEmbeddingsModel,
  warmSemanticSearchCache as warmSemanticSearchCacheService,
} from "./modules/semantic-search/service";
import { fetchOllamaResponse } from "./strategies/ollama";

const app = express();
const PORT = process.env["PORT"] ?? "3003";

app.use(express.json());
app.use(requestMetrics);

app.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "categorizer-service",
    semanticSearchCache: getSemanticSearchCacheStatus(),
    dependencies: {
      ollama: (await isOllamaUp()) ? "up" : "down",
    },
  });
});

app.get("/metrics", (_req, res) => {
  res.json(getMetricsSnapshot());
});

async function isOllamaUp(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetchOllamaResponse("/api/tags", {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

app.use("/categorize", categorizerRouter);

app.listen(Number(PORT), () => {
  console.log(`categorizer-service running on port ${PORT}`);
  startMessaging();
  void registerConsumers();
  void warmSemanticSearchCacheOnStartup();
});

async function registerConsumers(): Promise<void> {
  await consume<CategoryChangedEvent>(QUEUES.categorySync, async (event) => {
    console.log(`[categorizer] received category.changed (${event.trigger}), refreshing cache`);
    await warmSemanticSearchCacheService();
    const status = getSemanticSearchCacheStatus();
    console.log(`[categorizer] cache refreshed: ${status.categoryCount} categories`);
  });
}

const WARMUP_RETRY_DELAY_MS = 5_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// El catalogo de categorias vive en reservation-service y se obtiene por HTTP.
// Como categorizer-service puede arrancar antes de que reservation-service este
// disponible (o antes de que las categorias se sembren), reintentamos el warmup
// en segundo plano hasta que tenga exito en vez de fallar una sola vez.
//
// El modelo ONNX se inicializa primero, de forma separada, para que su carga
// (que puede tardar minutos y bloquea el event loop) no impida que el delay()
// entre reintentos se ejecute.
async function warmSemanticSearchCacheOnStartup(): Promise<void> {
  console.log("categorizer-service initializing embeddings model...");
  await warmEmbeddingsModel();
  console.log("categorizer-service embeddings model ready");

  let attempt = 0;

  for (;;) {
    attempt += 1;
    const startedAt = Date.now();

    try {
      await warmSemanticSearchCacheService();
      const cacheStatus = getSemanticSearchCacheStatus();
      console.log(
        `categorizer-service semantic cache warmed for ${cacheStatus.categoryCount} categories in ${Date.now() - startedAt}ms (attempt ${attempt})`
      );
      return;
    } catch (error) {
      console.warn(
        `categorizer-service semantic cache warmup attempt ${attempt} failed: ${
          error instanceof Error ? error.message : String(error)
        }; retrying in ${WARMUP_RETRY_DELAY_MS}ms`
      );
      await delay(WARMUP_RETRY_DELAY_MS);
    }
  }
}
