import "dotenv/config";
import express from "express";
import { requestLogger } from "./middleware/logging";
import { rateLimiter } from "./middleware/rate-limit";
import { authenticate } from "./middleware/auth";
import {
  reservationsRouter,
  validateReservationsProxyConfiguration,
  webhooksRouter,
} from "./routes/reservations";
import { transportationsRouter } from "./routes/transportations";

const app = express();
const PORT = process.env["PORT"] ?? "3000";

app.use(requestLogger);
app.use(rateLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

// Stripe signatures require the original request body, so webhooks must be proxied
// before the JSON parser touches the payload.
app.use("/webhooks", webhooksRouter);
app.use(express.json());
app.use("/reservations", reservationsRouter);
app.use("/transportations", authenticate, transportationsRouter);

validateReservationsProxyConfiguration();

app.listen(Number(PORT), () => {
  console.log(`api-gateway running on port ${PORT}`);
});
