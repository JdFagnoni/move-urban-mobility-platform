import { createPublicKey, type JsonWebKey, type KeyObject } from "crypto";
import type { NextFunction, Request, Response as ExpressResponse } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface OidcClaims extends JwtPayload {
  sub: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: OidcClaims;
  }
}

interface JwksResponse {
  keys: Array<JsonWebKey & { kid?: string }>;
}

class GatewayAuthError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const JWKS_CACHE_MS = 10 * 60 * 1000;
const JWKS_TIMEOUT_MS = 5_000;
const signingKeyCache = new Map<string, { key: KeyObject; expiresAt: number }>();

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new GatewayAuthError(503, `${name} is not configured`);
  }
  return value;
}

function getAuth0Domain(): string {
  return getRequiredEnv("AUTH0_DOMAIN")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function getAuth0Audience(): string {
  return getRequiredEnv("AUTH0_AUDIENCE");
}

function getIssuer(): string {
  return `https://${getAuth0Domain()}/`;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

async function fetchSigningKey(kid: string): Promise<KeyObject> {
  const cached = signingKeyCache.get(kid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  const response = await fetchWithTimeout(
    `https://${getAuth0Domain()}/.well-known/jwks.json`,
    "fetch Auth0 JWKS"
  );
  if (!response.ok) {
    throw new GatewayAuthError(503, "Authentication service is unavailable");
  }

  const jwks = (await response.json()) as JwksResponse;
  const jwk = jwks.keys.find((key) => key.kid === kid);
  if (!jwk) {
    throw new GatewayAuthError(401, "Invalid token");
  }

  const key = createPublicKey({ key: jwk, format: "jwk" });
  signingKeyCache.set(kid, { key, expiresAt: Date.now() + JWKS_CACHE_MS });
  return key;
}

async function verifyAccessToken(token: string): Promise<OidcClaims> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
    throw new GatewayAuthError(401, "Invalid token");
  }

  const key = await fetchSigningKey(decoded.header.kid);

  let payload: string | JwtPayload;
  try {
    payload = jwt.verify(token, key, {
      algorithms: ["RS256"],
      audience: getAuth0Audience(),
      issuer: getIssuer(),
    });
  } catch {
    throw new GatewayAuthError(401, "Invalid token");
  }

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new GatewayAuthError(401, "Invalid token");
  }

  return payload as OidcClaims;
}

async function fetchWithTimeout(url: string, operation: string): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JWKS_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (isAbortError(error)) {
      throw new GatewayAuthError(
        503,
        `Authentication service timed out while trying to ${operation}`
      );
    }
    throw new GatewayAuthError(503, "Authentication service is unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function getAuthErrorResponse(error: unknown): { statusCode: number; message: string } {
  if (error instanceof GatewayAuthError) {
    return {
      statusCode: error.statusCode,
      message: error.statusCode === 503 ? "Authentication service unavailable" : error.message,
    };
  }

  return {
    statusCode: 503,
    message: "Authentication service unavailable",
  };
}

export async function authenticate(
  req: Request,
  res: ExpressResponse,
  next: NextFunction
): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: "Missing bearer token" });
    return;
  }

  try {
    req.user = await verifyAccessToken(token);
    next();
  } catch (error) {
    const authError = getAuthErrorResponse(error);
    res.status(authError.statusCode).json({ success: false, error: authError.message });
  }
}
