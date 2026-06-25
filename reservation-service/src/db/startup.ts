type RetryOptions = {
  attempts: number;
  delayMs: number;
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function withRetry(
  operation: () => Promise<void>,
  { attempts, delayMs }: RetryOptions
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      process.stderr.write(
        `Database startup attempt ${attempt}/${attempts} failed: ${String(error)}. Retrying in ${delayMs}ms.\n`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}
