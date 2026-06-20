// Helpers de autenticacion para los scripts de performance K6.
// No existe bypass de Auth0 en el sistema (api-gateway/src/middleware/auth.ts
// valida JWT RS256 real contra JWKS), asi que estos scripts obtienen tokens
// reales con Resource Owner Password Grant, igual que las colecciones de
// postman/ del equipo.

import http from "k6/http";
import { sleep } from "k6";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  AUTH0_DOMAIN,
  AUTH0_REALM,
  BASE_URL,
} from "./config.ts";

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
// emails fijos, por eso se tolera junto con 201. Devuelve el UserDTO creado
// cuando el registro es nuevo (201), o null si el usuario ya existia (409).
//
// Registrar hace que reservation-service llame a la Management API de Auth0
// para crear la identidad; se observaron fallos transitorios puntuales
// ("fetch failed" -> 503) durante pruebas con muchos registros seguidos, que
// se resuelven solos en un segundo intento. Por eso se reintenta una vez
// sobre 503 antes de abortar el setup completo por un blip de red.
export function registerClient(
  email: string,
  password: string,
  name: string,
  clientType: ClientType,
  extra?: Record<string, string>
): { id: string; role: string } | null {
  const body = JSON.stringify({ email, password, name, clientType, ...extra });
  const headers = { "Content-Type": "application/json" };

  let res = http.post(`${BASE_URL}/reservations/auth/register`, body, { headers });
  if (res.status === 503) {
    sleep(1);
    res = http.post(`${BASE_URL}/reservations/auth/register`, body, { headers });
  }

  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`Register failed for ${email}: ${res.status} ${res.body}`);
  }

  if (res.status === 409) {
    return null;
  }

  return (res.json() as { data: { id: string; role: string } }).data;
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

  // La respuesta real anida el perfil bajo data.user (no data directamente).
  return (res.json() as { data: { user: { id: string; role: string } } }).data.user;
}

export function promoteUser(adminToken: string, userId: string, role: PromotableRole): void {
  const res = http.patch(`${BASE_URL}/reservations/users/${userId}`, JSON.stringify({ role }), {
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
  });

  if (res.status !== 200) {
    throw new Error(`Promote to ${role} failed for ${userId}: ${res.status} ${res.body}`);
  }
}

// Registra (o reutiliza, si ya existe) un usuario y lo deja con el rol
// pedido. No hay forma de auto-registrarse como operator/driver, por eso
// hace falta el paso de promocion con token admin. Usado para crear el
// operador de R2 y cada conductor de los traslados activos de R2.
export function ensurePromotedUser(
  adminToken: string,
  email: string,
  password: string,
  name: string,
  role: PromotableRole
): { token: string; id: string } {
  registerClient(email, password, name, "individual");
  const token = getAuth0Token(email, password);
  const profile = getCurrentUser(token);

  if (profile.role !== role) {
    promoteUser(adminToken, profile.id, role);
  }

  return { token, id: profile.id };
}
