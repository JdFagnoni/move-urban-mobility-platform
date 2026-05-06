import "dotenv/config";
import express from "express";
import { requestLogger } from "./middleware/logging";
import { rateLimiter } from "./middleware/rate-limit";
import { authenticate } from "./middleware/auth";
import { reservasRouter } from "./routes/reservas";
import { trasladosRouter } from "./routes/traslados";

const app = express();
const PORT = process.env["PORT"] ?? "3000";

app.use(express.json());
app.use(requestLogger);
app.use(rateLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

app.use("/reservas", authenticate, reservasRouter);
app.use("/traslados", authenticate, trasladosRouter);

app.listen(Number(PORT), () => {
  console.log(`api-gateway running on port ${PORT}`);
});
