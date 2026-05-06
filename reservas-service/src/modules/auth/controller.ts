import type { Request, Response } from "express";
import { register, login } from "./service";
import type { CreateUserDTO, LoginDTO } from "@move/shared";

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const dto = req.body as CreateUserDTO;
  const user = await register(dto);
  res.status(201).json({ success: true, data: user });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const dto = req.body as LoginDTO;
  const tokens = await login(dto);
  res.json({ success: true, data: tokens });
}
