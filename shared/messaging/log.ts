type MessagingLogLevel = "info" | "warn" | "error";

export function logMessaging(
  level: MessagingLogLevel,
  event: string,
  data: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({ level, component: "messaging", event, ...data });
  if (level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
