import type { Response } from "express";
import type { RequestContext } from "@move/shared";
import { getErrorMessage, getErrorStatus } from "@move/shared";

export type ServiceExecutionResult<T> = { ok: true; data: T } | { ok: false };

export async function handleServiceError<T>(
  res: Response,
  operation: () => Promise<T>,
  context?: RequestContext
): Promise<ServiceExecutionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const statusCode = getErrorStatus(error);
    const errorMessage = getErrorMessage(error);
    console.error(
      JSON.stringify({
        level: "error",
        event: "reservation_service_request_failed",
        method: context?.method,
        path: context?.path,
        correlationId: context?.correlationId,
        statusCode,
        responseMessage: errorMessage,
        error: serializeError(error),
      })
    );
    res.status(statusCode).json({ success: false, error: errorMessage });
    return { ok: false };
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { value: String(error) };
}
