import { recordAuditLog } from "../modules/auth/audit";
import { createUserRecord, getUserByAuthSubject, getUserByEmail } from "../modules/users/service";

export async function seedBootstrapAdmin(): Promise<void> {
  const authSubject = process.env["BOOTSTRAP_ADMIN_AUTH_SUBJECT"];
  const email = process.env["BOOTSTRAP_ADMIN_EMAIL"];
  const name = process.env["BOOTSTRAP_ADMIN_NAME"] ?? "MOVE Admin";

  if (!authSubject || !email) {
    return;
  }

  const existingBySubject = await getUserByAuthSubject(authSubject);
  if (existingBySubject) {
    return;
  }

  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail) {
    return;
  }

  const user = await createUserRecord({
    authSubject,
    email,
    name,
    role: "admin",
    clientType: null,
  });

  await recordAuditLog({
    eventType: "registration_success",
    decision: "success",
    statusCode: 201,
    userId: user.id,
    authSubject: user.authSubject,
    email: user.email,
    role: user.role,
    reason: "Bootstrap admin linked from environment",
  });
}
