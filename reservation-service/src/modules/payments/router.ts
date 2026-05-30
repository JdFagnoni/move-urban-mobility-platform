import { Router } from "express";
import { stripeWebhookHandler } from "./controller";

export const paymentsRouter = Router();

paymentsRouter.post("/webhooks/stripe", stripeWebhookHandler);
