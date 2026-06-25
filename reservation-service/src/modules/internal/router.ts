import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { Op } from "sequelize";
import { ReservationModel } from "../../db/models";
import { authenticate, requireRole } from "../auth/middleware";
import {
  getPaymentSimulationMode,
  isPaymentSimulationMode,
  setPaymentSimulationMode,
} from "../payments/simulation";
import { getUserByAuthSubject } from "../users/service";
import { requireInternalGatewaySecret } from "./middleware";

export const internalRouter = Router();

internalRouter.use(requireInternalGatewaySecret);

internalRouter.get(
  "/users/by-auth-subject/:authSubject",
  async (req: Request, res: Response): Promise<void> => {
    const { authSubject } = req.params as { authSubject: string };
    try {
      const user = await getUserByAuthSubject(authSubject);
      if (!user) {
        res.json({ success: true, data: null });
        return;
      }
      res.json({
        success: true,
        data: { id: user.id, role: user.role, status: user.status },
      });
    } catch {
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

internalRouter.get(
  "/vehicles/:vehicleId/active-reservation-count",
  async (req: Request, res: Response): Promise<void> => {
    const { vehicleId } = req.params as { vehicleId: string };
    try {
      const count = await ReservationModel.count({
        where: {
          vehicleId,
          status: { [Op.notIn]: ["completed", "cancelled"] },
        },
      });
      res.json({ success: true, data: { count } });
    } catch {
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

internalRouter.get(
  "/testing/payment-simulation",
  requireTestingHooksEnabled,
  authenticate,
  requireRole("admin"),
  (_req: Request, res: Response): void => {
    res.json({
      success: true,
      data: { mode: getPaymentSimulationMode() },
    });
  }
);

internalRouter.put(
  "/testing/payment-simulation",
  requireTestingHooksEnabled,
  authenticate,
  requireRole("admin"),
  (req: Request, res: Response): void => {
    const mode = req.body?.mode;
    if (!isPaymentSimulationMode(mode)) {
      res.status(400).json({
        success: false,
        error: "mode must be one of: none, unavailable",
      });
      return;
    }

    res.json({
      success: true,
      data: { mode: setPaymentSimulationMode(mode) },
    });
  }
);

function requireTestingHooksEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (process.env["ENABLE_TESTING_HOOKS"]?.trim().toLowerCase() === "true") {
    next();
    return;
  }

  res.status(404).json({ success: false, error: "Not found" });
}
