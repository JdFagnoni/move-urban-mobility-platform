import { EmbeddingsProviderError, type EmbeddingsPort } from "../ports/EmbeddingsPort";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_EMBEDDINGS_MODEL = "text-embedding-3-small";
const DEFAULT_TIMEOUT_MS = 10000;

interface OpenAiEmbeddingsResponse {
  data?: Array<{
    embedding?: number[];
  }>;
}

export class OpenAiEmbeddingsAdapter implements EmbeddingsPort {
  async embed(text: string): Promise<number[]> {
    const apiKey = getRequiredEnv("OPENAI_API_KEY");
    const model =
      process.env["OPENAI_EMBEDDINGS_MODEL"]?.trim() || DEFAULT_OPENAI_EMBEDDINGS_MODEL;
    const baseUrl = normalizeBaseUrl(process.env["OPENAI_API_BASE_URL"] ?? DEFAULT_OPENAI_BASE_URL);
    const timeoutMs = parseTimeoutMs(process.env["EMBEDDINGS_TIMEOUT_MS"]);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
          encoding_format: "float",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new EmbeddingsProviderError(await buildHttpError(response));
      }

      const body = (await response.json()) as OpenAiEmbeddingsResponse;
      const embedding = body.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new EmbeddingsProviderError(
          "OpenAI embeddings response did not include data[0].embedding"
        );
      }

      return embedding;
    } catch (error) {
      if (error instanceof EmbeddingsProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new EmbeddingsProviderError(
          `OpenAI embeddings request timed out after ${timeoutMs}ms`
        );
      }

      throw new EmbeddingsProviderError(
        `OpenAI embeddings request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new EmbeddingsProviderError(`${name} is not configured`);
  }

  return value;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/u, "");
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function buildHttpError(response: Response): Promise<string> {
  const rawBody = await response.text();
  const body = rawBody.trim();

  if (!body) {
    return `OpenAI embeddings returned HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    const message = parsed.error?.message;
    if (message) {
      return `OpenAI embeddings returned HTTP ${response.status}: ${message}`;
    }
  } catch {
    // Ignore non-JSON responses and fall back to the raw body.
  }

  return `OpenAI embeddings returned HTTP ${response.status}: ${body}`;
}
