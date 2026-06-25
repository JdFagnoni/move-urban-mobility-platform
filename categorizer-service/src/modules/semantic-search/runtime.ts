import type { EmbeddingsPort } from "./ports/EmbeddingsPort";
import { OpenAiEmbeddingsAdapter } from "./adapters/OpenAiEmbeddingsAdapter";
import { TransformersJsEmbeddingsAdapter } from "./adapters/TransformersJsEmbeddingsAdapter";

let embeddingsPort: EmbeddingsPort | null = null;

export function getEmbeddingsPort(): EmbeddingsPort {
  if (embeddingsPort) {
    return embeddingsPort;
  }

  const provider = (process.env["EMBEDDINGS_PROVIDER"] ?? "openai").trim().toLowerCase();
  switch (provider) {
    case "openai":
      embeddingsPort = new OpenAiEmbeddingsAdapter();
      return embeddingsPort;
    case "transformersjs":
      embeddingsPort = new TransformersJsEmbeddingsAdapter();
      return embeddingsPort;
    default:
      throw new Error(`Unsupported embeddings provider '${provider}'`);
  }
}
