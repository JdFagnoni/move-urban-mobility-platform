import "dotenv/config";

process.on("uncaughtException", (err: Error) => {
  process.stderr.write(`[reservations] uncaughtException: ${err.message}\n${err.stack ?? ""}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  process.stderr.write(`[reservations] unhandledRejection: ${message}\n`);
});

import express from "express";
import type { Request } from "express";
import { isConnected, query, requestMetrics } from "@move/shared";
import { initializeDatabase } from "./db/sequelize";
import { seedBootstrapAdmin, seedDefaultCategories } from "./db/seed";
import { withRetry } from "./db/startup";
import { authRouter } from "./modules/auth/router";
import { reservationsRouter } from "./modules/reservations/router";
import { categoriesRouter } from "./modules/categories/router";
import { preregistrationsRouter } from "./modules/preregistrations/router";
import { usersRouter } from "./modules/users/router";
import { paymentsRouter } from "./modules/payments/router";
import { metricsRouter } from "./modules/metrics/router";
import { startReservationMessaging } from "./messaging";
import { startFrequentClientRankingRefresh } from "./modules/reservations/fast-path-cache";

const app = express();
const PORT = process.env["PORT"] ?? "3001";

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      if (buffer.length > 0) {
        (req as Request).rawBody = buffer.toString("utf8");
      }
    },
  })
);

app.use(requestMetrics);

app.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "reservations",
    dependencies: {
      postgres: (await isPostgresUp()) ? "up" : "down",
      rabbitmq: isConnected() ? "up" : "down",
    },
  });
});

async function isPostgresUp(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

app.use("/metrics", metricsRouter);

app.use("/auth", authRouter);
app.use("/webhooks", paymentsRouter);
app.use("/reservations", reservationsRouter);
app.use("/categories", categoriesRouter);
app.use("/preregistrations", preregistrationsRouter);
app.use("/users", usersRouter);

async function start(): Promise<void> {
  await withRetry(initializeDatabase, { attempts: 10, delayMs: 3000 });
  await seedDefaultCategories();
  await seedBootstrapAdmin();
  await startFrequentClientRankingRefresh();
  startReservationMessaging();
  app.listen(Number(PORT), () => {
    process.stdout.write(`reservations running on port ${PORT}\n`);
  });
}

start().catch((error) => {
  process.stderr.write(`reservations failed to start: ${String(error)}\n`);
  process.exit(1);
});
