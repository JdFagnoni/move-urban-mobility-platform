import { EmbeddingsProviderError, type EmbeddingsPort } from "../ports/EmbeddingsPort";

const DEFAULT_TRANSFORMERSJS_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

interface TransformersJsEnvironment {
  allowRemoteModels: boolean;
  localModelPath?: string;
}

interface FeatureExtractionTensor {
  data?: ArrayLike<number>;
  dims?: number[];
}

interface FeatureExtractor {
  (
    text: string,
    options?: {
      pooling?: "mean";
      normalize?: boolean;
    }
  ): Promise<FeatureExtractionTensor>;
}

interface TransformersJsModule {
  env: TransformersJsEnvironment;
  pipeline: (task: "feature-extraction", model: string) => Promise<FeatureExtractor>;
}

export class TransformersJsEmbeddingsAdapter implements EmbeddingsPort {
  private extractorPromise: Promise<FeatureExtractor> | null = null;

  async embed(text: string): Promise<number[]> {
    try {
      const extractor = await this.getExtractor();
      const output = await extractor(text, { pooling: "mean", normalize: true });
      const embedding = output.data ? Array.from(output.data) : [];

      if (embedding.length === 0) {
        throw new EmbeddingsProviderError(
          "Transformers.js feature extraction returned an empty embedding"
        );
      }

      return embedding;
    } catch (error) {
      if (error instanceof EmbeddingsProviderError) {
        throw error;
      }

      throw new EmbeddingsProviderError(
        `Transformers.js embeddings request failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async getExtractor(): Promise<FeatureExtractor> {
    if (this.extractorPromise) {
      return this.extractorPromise;
    }

    this.extractorPromise = this.initializeExtractor();
    try {
      return await this.extractorPromise;
    } catch (error) {
      this.extractorPromise = null;
      throw error;
    }
  }

  private async initializeExtractor(): Promise<FeatureExtractor> {
    const { env, pipeline } =
      (await import("@huggingface/transformers")) as unknown as TransformersJsModule;

    configureEnvironment(env);

    const model =
      process.env["TRANSFORMERSJS_EMBEDDINGS_MODEL"]?.trim() || DEFAULT_TRANSFORMERSJS_MODEL;

    return pipeline("feature-extraction", model);
  }
}

function configureEnvironment(env: TransformersJsEnvironment): void {
  env.allowRemoteModels = parseBooleanEnv(process.env["TRANSFORMERSJS_ALLOW_REMOTE_MODELS"], true);

  const localModelPath = process.env["TRANSFORMERSJS_LOCAL_MODEL_PATH"]?.trim();
  if (localModelPath) {
    env.localModelPath = localModelPath;
  }
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return defaultValue;
  }
}
