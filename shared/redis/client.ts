import Redis from "ioredis";

const connectionString = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const redisClient = new Redis(connectionString, {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 200, 2000),
  lazyConnect: false,
});

redisClient.on("error", (err: unknown) => {
  console.error("[redis] connection error:", err);
});
