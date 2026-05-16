import type { RegisterClientDTO, UserDTO } from "@move/shared";
import { HttpError, type RequestContext } from "@move/shared";
import { createAuth0User } from "./auth0-provider";
import { recordAuditLog } from "./audit";
import { createUserRecord, getUserByEmail } from "../users/service";

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new HttpError(400, "A valid email is required", "invalid_registration");
  }
  return normalized;
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new HttpError(400, "Name is required", "invalid_registration");
  }
  return normalized;
}

function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new HttpError(400, "Password must have at least 8 characters", "invalid_registration");
  }
}

export async function registerClient(
  dto: RegisterClientDTO,
  context: RequestContext
): Promise<UserDTO> {
  const email = normalizeEmail(dto.email);
  const name = normalizeName(dto.name);
  validatePassword(dto.password);
  const clientType = dto.clientType ?? "individual";

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      throw new HttpError(409, "User already exists", "user_exists");
    }

    const authSubject = await createAuth0User({ ...dto, email, name, clientType });
    const user = await createUserRecord({
      authSubject,
      email,
      name,
      role: "client",
      clientType,
      phone: dto.phone,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      companyName: dto.companyName,
      taxId: dto.taxId,
    });

    await recordAuditLog({
      ...context,
      eventType: "registration_success",
      decision: "success",
      statusCode: 201,
      userId: user.id,
      authSubject: user.authSubject,
      email: user.email,
      role: user.role,
      clientType: user.clientType,
    });

    return user;
  } catch (error) {
    await recordAuditLog({
      ...context,
      eventType: "registration_failure",
      decision: "failed",
      statusCode: error instanceof HttpError ? error.statusCode : 500,
      email,
      clientType,
      reason: error instanceof Error ? error.message : "Registration failed",
    });
    throw error;
  }
}
