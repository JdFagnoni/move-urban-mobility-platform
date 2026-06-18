import "dotenv/config";
import express from "express";
import type { Request } from "express";
import { initializeDatabase } from "./db/sequelize";
import { seedBootstrapAdmin, seedDefaultCategories } from "./db/seed";
import { withRetry } from "./db/startup";
import { authRouter } from "./modules/auth/router";
import { reservationsRouter } from "./modules/reservations/router";
import { categoriesRouter } from "./modules/categories/router";
import { preregistrationsRouter } from "./modules/preregistrations/router";
import { usersRouter } from "./modules/users/router";
import { paymentsRouter } from "./modules/payments/router";
import { startReservationMessaging } from "./messaging";

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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "reservations" });
});

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
  startReservationMessaging();
  app.listen(Number(PORT), () => {
    process.stdout.write(`reservations running on port ${PORT}\n`);
  });
}

start().catch((error) => {
  process.stderr.write(`reservations failed to start: ${String(error)}\n`);
  process.exit(1);
});
