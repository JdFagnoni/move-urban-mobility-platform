import "dotenv/config";
import express from "express";
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

app.listen(Number(PORT), () => {
  console.log(`reservas-service running on port ${PORT}`);
});
