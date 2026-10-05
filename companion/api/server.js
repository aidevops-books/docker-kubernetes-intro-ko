const express = require("express");
const { createClient } = require("redis");

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const redisClient = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  disableOfflineQueue: true,
  socket: { connectTimeout: 2000 }
});
redisClient.on("error", (err) => console.error("Redis Client Error", err.message));
// 연결은 요청마다 만들지 않고 백그라운드에서 한 번 시작합니다.
redisClient.connect().catch((err) => console.error("Redis connect failed", err.message));

app.get("/", (req, res) => {
  res.json({ message: "Docker & Kubernetes 최신 입문 API", redisHost: REDIS_HOST });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/ready", (req, res) => {
  res.status(redisClient.isReady ? 200 : 503).json({ ready: redisClient.isReady });
});

// Redis에 연결해 방문 횟수를 1 증가시키고 반환한다.
// Chapter 6에서는 이 엔드포인트를 호출하면 Redis가 아직 없어 오류가 발생하는 것이
// 정상이다. Chapter 7에서 Redis Container를 연결하면 정상 동작한다.
app.get("/api/count", async (req, res) => {
  try {
    if (!redisClient.isReady) {
      return res.status(503).json({ error: "Redis가 아직 준비되지 않았습니다" });
    }
    const count = await redisClient.incr("visit-count");
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Redis에 연결할 수 없습니다", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT} (REDIS_HOST=${REDIS_HOST})`);
});
