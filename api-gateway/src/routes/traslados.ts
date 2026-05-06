import { Router } from "express";
import proxy from "express-http-proxy";

const TRASLADOS_URL =
  process.env["TRASLADOS_SERVICE_URL"] ?? "http://localhost:3002";

export const trasladosRouter = Router();

trasladosRouter.use("/", proxy(TRASLADOS_URL));
