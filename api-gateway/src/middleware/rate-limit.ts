import rateLimit from "express-rate-limit";

const WINDOW_MS = 60 * 1_000;
const MAX_REQUESTS_PER_WINDOW = 300;

export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests, please try again later." },
});
