// Helpers de autenticacion para los scripts de performance K6.
// No existe bypass de Auth0 en el sistema (api-gateway/src/middleware/auth.ts
// valida JWT RS256 real contra JWKS), asi que estos scripts obtienen tokens
// reales con Resource Owner Password Grant, igual que las colecciones de
// postman/ del equipo.

import http from "k6/http";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  AUTH0_DOMAIN,
  AUTH0_REALM,
  BASE_URL,
} from "./config";

export type ClientType = "individual" | "company";
export type PromotableRole = "operator" | "driver";

export function getAuth0Token(username: string, password: string): string {
  const res = http.post(
    `https://${AUTH0_DOMAIN}/oauth/token`,
    JSON.stringify({
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      username,
      password,
      audience: AUTH0_AUDIENCE,
      scope: "openid profile email",
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      realm: AUTH0_REALM,
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (res.status !== 200) {
    throw new Error(`Auth0 token request failed for ${username}: ${res.status} ${res.body}`);
  }

  return (res.json() as { access_token: string }).access_token;
}

export function getAdminToken(): string {
  return getAuth0Token(ADMIN_EMAIL, ADMIN_PASSWORD);
}

// POST /auth/register es publico y no tiene endpoint de reset/seed: 409
// (usuario ya existente) es el camino esperado en corridas repetidas con
// emails fijos, por eso se tolera junto con 201.
export function registerClient(
  email: string,
  password: string,
  name: string,
  clientType: ClientType,
  extra?: Record<string, string>
): void {
  const res = http.post(
    `${BASE_URL}/reservations/auth/register`,
    JSON.stringify({ email, password, name, clientType, ...extra }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`Register failed for ${email}: ${res.status} ${res.body}`);
  }
}

export function registerAndLogin(
  email: string,
  password: string,
  name: string,
  clientType: ClientType,
  extra?: Record<string, string>
): string {
  registerClient(email, password, name, clientType, extra);
  return getAuth0Token(email, password);
}

export function getCurrentUser(token: string): { id: string; role: string } {
  const res = http.get(`${BASE_URL}/reservations/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status !== 200) {
    throw new Error(`auth/me failed: ${res.status} ${res.body}`);
  }

  return (res.json() as { data: { id: string; role: string } }).data;
}

export function promoteUser(adminToken: string, userId: string, role: PromotableRole): void {
  const res = http.patch(
    `${BASE_URL}/reservations/users/${userId}`,
    JSON.stringify({ role }),
    { headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" } }
  );

  if (res.status !== 200) {
    throw new Error(`Promote to ${role} failed for ${userId}: ${res.status} ${res.body}`);
  }
}
