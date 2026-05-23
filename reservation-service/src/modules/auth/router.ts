import { Router } from "express";
import { listAuditLogsHandler, meHandler, registerHandler } from "./controller";
import { authenticate, requireRole } from "./middleware";

export const authRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.get("/me", authenticate, meHandler);
authRouter.get("/audit-logs", authenticate, requireRole("admin"), listAuditLogsHandler);
