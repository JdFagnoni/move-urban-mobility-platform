import { Router } from "express";
import type { Request, Response } from "express";
import { Op } from "sequelize";
import { ReservationModel } from "../../db/models";
import { requireInternalGatewaySecret } from "./middleware";

export const internalRouter = Router();

internalRouter.use(requireInternalGatewaySecret);

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
