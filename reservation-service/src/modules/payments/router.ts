import { Router } from "express";
import { stripeWebhookHandler } from "./controller";

export const paymentsRouter = Router();

paymentsRouter.post("/stripe", stripeWebhookHandler);
