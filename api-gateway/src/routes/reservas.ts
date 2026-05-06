import { Router } from "express";
import proxy from "express-http-proxy";

const RESERVAS_URL =
  process.env["RESERVAS_SERVICE_URL"] ?? "http://localhost:3001";

export const reservasRouter = Router();

reservasRouter.use("/", proxy(RESERVAS_URL));
