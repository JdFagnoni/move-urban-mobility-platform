const DEFAULT_OLLAMA_URL = "http://localhost:11434";

export interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
}

export function getOllamaBaseUrl(): string {
  const configured = process.env["OLLAMA_URL"] ?? DEFAULT_OLLAMA_URL;
  const normalized = configured.trim().replace(/\/+$/u, "");

  return normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized;
}

export async function fetchOllamaResponse(
  path: string,
  init: RequestInit
): Promise<Response> {
  return fetch(`${getOllamaBaseUrl()}${path}`, init);
}

export async function buildOllamaHttpError(response: Response): Promise<string> {
  const rawBody = await response.text();
  const body = rawBody.trim();

  if (!body) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) {
      return `HTTP ${response.status}: ${parsed.error}`;
    }
  } catch {
    // Ignore non-JSON responses and fall back to the raw body.
  }

  return `HTTP ${response.status}: ${body}`;
}

export async function resolveOllamaModel(
  configuredModel: string,
  fallbackModels: readonly string[]
): Promise<string> {
  const availableModels = await listAvailableOllamaModels();
  const candidates = [configuredModel, ...fallbackModels];

  for (const candidate of candidates) {
    if (availableModels.has(candidate)) {
      return candidate;
    }

    if (!candidate.includes(":") && availableModels.has(`${candidate}:latest`)) {
      return `${candidate}:latest`;
    }
  }

  throw new Error(
    `No compatible Ollama model is installed. Requested '${configuredModel}'. Available models: ${[...availableModels].join(", ") || "none"}`
  );
}

async function listAvailableOllamaModels(): Promise<Set<string>> {
  const response = await fetchOllamaResponse("/api/tags", { method: "GET" });
  if (!response.ok) {
    throw new Error(await buildOllamaHttpError(response));
  }

  const body = (await response.json()) as OllamaTagsResponse;
  const availableModels = new Set<string>();

  for (const model of body.models ?? []) {
    if (model.name) {
      availableModels.add(model.name);
    }

    if (model.model) {
      availableModels.add(model.model);
    }
  }

  return availableModels;
}
