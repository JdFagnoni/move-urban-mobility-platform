import { createPublicKey, type JsonWebKey, type KeyObject } from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { HttpError } from "@move/shared";

interface JwksResponse {
  keys: Array<JsonWebKey & { kid?: string }>;
}

export interface OidcClaims extends JwtPayload {
  sub: string;
  scope?: string;
  permissions?: string[];
}

const signingKeyCache = new Map<string, { key: KeyObject; expiresAt: number }>();
const JWKS_CACHE_MS = 10 * 60 * 1000;

function getAuth0Domain(): string {
  const domain = process.env["AUTH0_DOMAIN"];
  if (!domain) {
    throw new HttpError(503, "Auth0 domain is not configured", "auth0_not_configured");
  }
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function getAudience(): string {
  const audience = process.env["AUTH0_AUDIENCE"];
  if (!audience) {
    throw new HttpError(503, "Auth0 audience is not configured", "auth0_not_configured");
  }
  return audience;
}

function getIssuer(): string {
  return `https://${getAuth0Domain()}/`;
}

async function fetchSigningKey(kid: string): Promise<KeyObject> {
  const cached = signingKeyCache.get(kid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  const response = await fetch(`https://${getAuth0Domain()}/.well-known/jwks.json`);
  if (!response.ok) {
    throw new HttpError(503, "Could not fetch Auth0 JWKS", "auth0_jwks_unavailable");
  }

  const jwks = (await response.json()) as JwksResponse;
  const jwk = jwks.keys.find((key) => key.kid === kid);
  if (!jwk) {
    throw new HttpError(401, "Token signing key was not found", "unknown_signing_key");
  }

  const key = createPublicKey({ key: jwk, format: "jwk" });
  signingKeyCache.set(kid, { key, expiresAt: Date.now() + JWKS_CACHE_MS });
  return key;
}

export async function verifyAccessToken(token: string): Promise<OidcClaims> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
    throw new HttpError(401, "Invalid token header", "invalid_token");
  }

  const key = await fetchSigningKey(decoded.header.kid);
  const payload = jwt.verify(token, key, {
    algorithms: ["RS256"],
    audience: getAudience(),
    issuer: getIssuer(),
  });

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new HttpError(401, "Invalid token payload", "invalid_token");
  }

  return payload as OidcClaims;
}
