import { Router } from "express";
import { registerHandler, loginHandler } from "./controller";

export const authRouter = Router();

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
