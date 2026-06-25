export class HttpError extends Error {
  public readonly statusCode: number;

  public readonly code: string;

  public constructor(statusCode: number, message: string, code = "http_error") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getErrorStatus(error: unknown): number {
  return error instanceof HttpError ? error.statusCode : 500;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return error.message;
  }
  return "Internal server error";
}
