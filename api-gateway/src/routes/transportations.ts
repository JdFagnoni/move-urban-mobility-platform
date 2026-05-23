import { Router } from "express";
import proxy from "express-http-proxy";

const TRANSPORTATIONS_URL = process.env["TRANSPORTATIONS_URL"] ?? "http://localhost:3002";

export const transportationsRouter = Router();

transportationsRouter.use("/", proxy(TRANSPORTATIONS_URL));
