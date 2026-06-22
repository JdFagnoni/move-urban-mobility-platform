import rateLimit from "express-rate-limit";

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const WINDOW_MS = positiveIntFromEnv("RATE_LIMIT_WINDOW_MS", 60 * 1_000);
const MAX_REQUESTS_PER_WINDOW = positiveIntFromEnv("RATE_LIMIT_MAX_REQUESTS", 300);

export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});
