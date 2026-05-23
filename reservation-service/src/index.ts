import "dotenv/config";
import express from "express";
import { initializeDatabase } from "./db/sequelize";
import { seedBootstrapAdmin } from "./db/seed";
import { authRouter } from "./modules/auth/router";
import { reservationsRouter } from "./modules/reservations/router";
import { categoriesRouter } from "./modules/categories/router";
import { zonesRouter } from "./modules/zones/router";
import { vehiclesRouter } from "./modules/vehicles/router";
import { usersRouter } from "./modules/users/router";

const app = express();
const PORT = process.env["PORT"] ?? "3001";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "reservas-service" });
});

app.use("/auth", authRouter);
app.use("/reservations", reservationsRouter);
app.use("/categories", categoriesRouter);
app.use("/zones", zonesRouter);
app.use("/vehicles", vehiclesRouter);
app.use("/users", usersRouter);

async function start(): Promise<void> {
  await initializeDatabase();
  await seedBootstrapAdmin();
  app.listen(Number(PORT), () => {
    process.stdout.write(`reservas-service running on port ${PORT}\n`);
  });
}

start().catch((error) => {
  process.stderr.write(`reservas-service failed to start: ${String(error)}\n`);
  process.exit(1);
});
