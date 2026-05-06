import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { AuthTokenDTO, CreateUserDTO, LoginDTO, UserDTO } from "@move/shared";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "change-me-in-production";
const JWT_EXPIRES_IN = 3600;

// F1 – registro de usuario
export async function register(dto: CreateUserDTO): Promise<UserDTO> {
  const passwordHash = await bcrypt.hash(dto.password, 12);
  // TODO: persist to DB
  const user: UserDTO = {
    id: crypto.randomUUID(),
    email: dto.email,
    name: dto.name,
    role: dto.role,
    createdAt: new Date().toISOString(),
  };
  void passwordHash;
  return user;
}

// F2 – login
export async function login(dto: LoginDTO): Promise<AuthTokenDTO> {
  // TODO: fetch user from DB and verify password
  const payload = { sub: "user-id", role: "passenger" };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ sub: payload.sub }, JWT_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken, expiresIn: JWT_EXPIRES_IN };
}
