export interface EmbeddingsPort {
  embed(text: string): Promise<number[]>;
}

export class EmbeddingsProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingsProviderError";
  }
}
