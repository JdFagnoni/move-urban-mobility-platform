import "dotenv/config";
import express from "express";
import { getMetricsSnapshot, requestMetrics } from "@move/shared";
import { requestLogger } from "./middleware/logging";
import { rateLimiter } from "./middleware/rate-limit";
import {
  reservationsRouter,
  validateReservationsProxyConfiguration,
  webhooksRouter,
} from "./routes/reservations";
import { transportationsRouter } from "./routes/transportations";

const app = express();
const PORT = process.env["PORT"] ?? "3000";

app.use(requestLogger);
app.use(requestMetrics);
app.use(rateLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

app.get("/metrics", (_req, res) => {
  res.json(getMetricsSnapshot());
});

// Stripe signatures require the original request body, so webhooks must be proxied
// before the JSON parser touches the payload.
app.use("/webhooks", webhooksRouter);
app.use(express.json());
app.use("/reservations", reservationsRouter);
app.use("/transportations", transportationsRouter);

validateReservationsProxyConfiguration();

app.listen(Number(PORT), () => {
  console.log(`api-gateway running on port ${PORT}`);
});
