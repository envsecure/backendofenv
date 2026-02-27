import { createClient } from "redis";

let redis;

export async function getRedis() {
  if (redis && redis.isOpen) {
    return redis;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  redis = createClient({
    url: redisUrl,
  });

  redis.on("error", (err) => {
    console.error("❌ Redis error:", err);
  });

  redis.on("connect", () => {
    console.log("✅ Redis connected");
  });

  await redis.connect();

  return redis;
}