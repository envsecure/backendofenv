import { Router } from "express";
import { randomBytes } from "crypto";
import { getRedis } from "../lib/redis.js";

const router = Router();
const PREFIX = "envshare:";

// POST /api/store — save encrypted blob
router.post("/store", async (req, res) => {
  try {
    const { encryptedData, iv, salt, maxReads, ttlMinutes } = req.body;

    if (!encryptedData || !iv || !salt) {
      return res.status(400).json({ error: "Missing encryptedData, iv, or salt" });
    }

    const maxR = Math.min(parseInt(maxReads) || 5, 100);
    const ttl = Math.min(parseInt(ttlMinutes) || 60, 10080); // max 7 days
    const id = randomBytes(16).toString("hex");
    const r = await getRedis();

    await r.setEx(
      `${PREFIX}${id}`,
      ttl * 60,
      JSON.stringify({ encryptedData, iv, salt, maxReads: maxR, reads: 0, ttlMinutes: ttl })
    );

    res.json({ id, ttlMinutes: ttl, maxReads: maxR });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/retrieve/:id — fetch blob + decrement read count
router.get("/retrieve/:id", async (req, res) => {
  try {
    const r = await getRedis();
    const key = `${PREFIX}${req.params.id}`;
    const raw = await r.get(key);

    if (!raw) {
      return res.status(404).json({ error: "Link not found or already expired." });
    }

    const data = JSON.parse(raw);

    if (data.reads >= data.maxReads) {
      await r.del(key);
      return res.status(410).json({ error: "Max reads reached — this link has been deleted." });
    }

    data.reads += 1;

    if (data.reads >= data.maxReads) {
      await r.del(key);
    } else {
      const remainingTtl = await r.ttl(key);
      await r.setEx(key, remainingTtl, JSON.stringify(data));
    }

    res.json({
      encryptedData: data.encryptedData,
      iv: data.iv,
      salt: data.salt,
      readsUsed: data.reads,
      maxReads: data.maxReads,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/info/:id — peek metadata without consuming a read
router.get("/info/:id", async (req, res) => {
  try {
    const r = await getRedis();
    const key = `${PREFIX}${req.params.id}`;
    const raw = await r.get(key);

    if (!raw) return res.status(404).json({ error: "Not found" });

    const { maxReads, reads, ttlMinutes } = JSON.parse(raw);
    const ttlSeconds = await r.ttl(key);

    res.json({ maxReads, reads, readsLeft: maxReads - reads, ttlSeconds });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
