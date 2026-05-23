import type { Response } from "express";
import { getErrorMessage, getErrorStatus } from "@move/shared";

export type ServiceExecutionResult<T> = { ok: true; data: T } | { ok: false };

export async function handleServiceError<T>(
  res: Response,
  operation: () => Promise<T>
): Promise<ServiceExecutionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    res.status(getErrorStatus(error)).json({ success: false, error: getErrorMessage(error) });
    return { ok: false };
  }
}
