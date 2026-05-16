import type { RegisterClientDTO } from "@move/shared";
import { HttpError } from "@move/shared";

interface Auth0TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface Auth0CreateUserResponse {
  user_id: string;
  email: string;
  name?: string;
}

let cachedManagementToken: { token: string; expiresAt: number } | null = null;

function getAuth0Domain(): string {
  const domain = process.env["AUTH0_DOMAIN"];
  if (!domain) {
    throw new HttpError(503, "Auth0 domain is not configured", "auth0_not_configured");
  }
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
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

async function getManagementToken(): Promise<string> {
  const now = Date.now();
  if (cachedManagementToken && cachedManagementToken.expiresAt > now + 30_000) {
    return cachedManagementToken.token;
  }

  const domain = getAuth0Domain();
  const response = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: getRequiredEnv("AUTH0_MGMT_CLIENT_ID"),
      client_secret: getRequiredEnv("AUTH0_MGMT_CLIENT_SECRET"),
      audience: `https://${domain}/api/v2/`,
    }),
  });

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

export async function createAuth0User(dto: RegisterClientDTO): Promise<string> {
  const token = await getManagementToken();
  const domain = getAuth0Domain();
  const connection = getRequiredEnv("AUTH0_DB_CONNECTION");
  const response = await fetch(`https://${domain}/api/v2/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connection,
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
      name: dto.name.trim(),
      user_metadata: {
        move_client_type: dto.clientType ?? "individual",
      },
    }),
  });

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
  return body.user_id;
}
