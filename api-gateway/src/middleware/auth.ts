import { createPublicKey, type JsonWebKey, type KeyObject } from "crypto";
import type { Request, Response, NextFunction } from "express";
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

const signingKeyCache = new Map<string, { key: KeyObject; expiresAt: number }>();
const JWKS_CACHE_MS = 10 * 60 * 1000;

function getAuth0Domain(): string {
  const domain = process.env["AUTH0_DOMAIN"];
  if (!domain) {
    throw new Error("AUTH0_DOMAIN is not configured");
  }
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function getAudience(): string {
  const audience = process.env["AUTH0_AUDIENCE"];
  if (!audience) {
    throw new Error("AUTH0_AUDIENCE is not configured");
  }
  return audience;
}

function getIssuer(): string {
  return `https://${getAuth0Domain()}/`;
}

function isPublicRoute(req: Request): boolean {
  return (
    req.baseUrl === "/reservas" &&
    ((req.method === "POST" && req.path === "/auth/register") ||
      (req.method === "GET" && req.path === "/health"))
  );
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

  const response = await fetch(`https://${getAuth0Domain()}/.well-known/jwks.json`);
  if (!response.ok) {
    throw new Error("Could not fetch Auth0 JWKS");
  }

  const jwks = (await response.json()) as JwksResponse;
  const jwk = jwks.keys.find((key) => key.kid === kid);
  if (!jwk) {
    throw new Error("Token signing key was not found");
  }

  const key = createPublicKey({ key: jwk, format: "jwk" });
  signingKeyCache.set(kid, { key, expiresAt: Date.now() + JWKS_CACHE_MS });
  return key;
}

async function verifyAccessToken(token: string): Promise<OidcClaims> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
    throw new Error("Invalid token header");
  }

  const key = await fetchSigningKey(decoded.header.kid);
  const payload = jwt.verify(token, key, {
    algorithms: ["RS256"],
    audience: getAudience(),
    issuer: getIssuer(),
  });

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new Error("Invalid token payload");
  }

  return payload as OidcClaims;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isPublicRoute(req)) {
    next();
    return;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: "Missing bearer token" });
    return;
  }

  try {
    req.user = await verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid token" });
  }
}
