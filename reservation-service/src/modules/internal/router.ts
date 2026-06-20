import { Router } from "express";
import type { Request, Response } from "express";
import { Op } from "sequelize";
import { ReservationModel } from "../../db/models";
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
