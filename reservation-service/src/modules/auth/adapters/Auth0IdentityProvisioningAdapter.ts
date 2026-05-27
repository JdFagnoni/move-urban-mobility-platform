import type { RegisterClientDTO } from "@move/shared";
import { HttpError } from "@move/shared";
import type {
  AuthIdentityProvisioningPort,
  ProvisionedClientIdentity,
} from "../ports/AuthIdentityProvisioningPort";

interface Auth0TokenResponse {
  access_token: string;
  expires_in: number;
}

interface Auth0CreateUserResponse {
  user_id: string;
}

interface Auth0Config {
  domain: string;
  managementClientId: string;
  managementClientSecret: string;
  databaseConnection: string;
}

const AUTH0_TIMEOUT_MS = 5_000;
const MANAGEMENT_TOKEN_EXPIRY_BUFFER_MS = 30_000;

let cachedManagementToken: { token: string; expiresAt: number } | null = null;

export class Auth0IdentityProvisioningAdapter implements AuthIdentityProvisioningPort {
  public async createClientIdentity(dto: RegisterClientDTO): Promise<ProvisionedClientIdentity> {
    const config = loadAuth0Config();
    const token = await this.getManagementToken(config);
    const response = await fetchWithTimeout(
      `https://${config.domain}/api/v2/users`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection: config.databaseConnection,
          email: dto.email.trim().toLowerCase(),
          password: dto.password,
          name: dto.name.trim(),
          user_metadata: {
            move_client_type: dto.clientType ?? "individual",
          },
        }),
      },
      "create an Auth0 user"
    );

    if (response.status === 409) {
      throw new HttpError(409, "User already exists in Auth0", "auth0_user_exists");
    }

    if (!response.ok) {
      throw new HttpError(
        503,
        `Could not create user in Auth0: ${await parseAuth0Error(response)}`,
        "auth0_create_user_failed"
      );
    }

    const body = (await response.json()) as Auth0CreateUserResponse;
    return { authSubject: body.user_id };
  }

  private async getManagementToken(config: Auth0Config): Promise<string> {
    const now = Date.now();
    if (
      cachedManagementToken &&
      cachedManagementToken.expiresAt > now + MANAGEMENT_TOKEN_EXPIRY_BUFFER_MS
    ) {
      return cachedManagementToken.token;
    }

    const response = await fetchWithTimeout(
      `https://${config.domain}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: config.managementClientId,
          client_secret: config.managementClientSecret,
          audience: `https://${config.domain}/api/v2/`,
        }),
      },
      "obtain an Auth0 Management API token"
    );

    if (!response.ok) {
      throw new HttpError(
        503,
        `Could not obtain Auth0 Management API token: ${await parseAuth0Error(response)}`,
        "auth0_token_failed"
      );
    }

    const body = (await response.json()) as Auth0TokenResponse;
    cachedManagementToken = {
      token: body.access_token,
      expiresAt: now + body.expires_in * 1000,
    };
    return body.access_token;
  }
}

function loadAuth0Config(): Auth0Config {
  const domain = getRequiredEnv("AUTH0_DOMAIN")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return {
    domain,
    managementClientId: getRequiredEnv("AUTH0_MGMT_CLIENT_ID"),
    managementClientSecret: getRequiredEnv("AUTH0_MGMT_CLIENT_SECRET"),
    databaseConnection: getRequiredEnv("AUTH0_DB_CONNECTION"),
  };
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(503, `${name} is not configured`, "auth0_not_configured");
  }
  return value;
}

async function parseAuth0Error(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error_description?: string };
    return body.message ?? body.error_description ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  operation: string
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH0_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw mapAuth0NetworkError(error, operation);
  } finally {
    clearTimeout(timeout);
  }
}

function mapAuth0NetworkError(error: unknown, operation: string): HttpError {
  if (isAbortError(error)) {
    return new HttpError(
      503,
      `Auth0 request timed out while trying to ${operation}`,
      "auth0_request_timeout"
    );
  }

  const reason = error instanceof Error ? error.message : String(error);
  return new HttpError(503, `Could not ${operation}: ${reason}`, "auth0_request_failed");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
