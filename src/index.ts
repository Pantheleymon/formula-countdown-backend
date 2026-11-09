import express, { Request, Response as ExpressResponse } from "express";
import rateLimit from "express-rate-limit";
import { createHash } from "crypto";
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  SCALE,
  PNG_CACHE_TTL_MS,
  PNG_CACHE_MAX_ENTRIES,
  PNG_MAX_AGE_SECONDS,
  PORT,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
} from "./config";
import { INormalizedRace } from "./types";
import { queryString, parseDimension, resolveTimezone } from "./validation";
import { fetchNextRace, getRaceCache } from "./data-source";
import { renderWallpaper } from "./renderer";

// Кэш сгенерированных изображений
interface IPngCacheEntry {
  buffer: Buffer;
  etag: string;
  generatedAt: number;
}
const pngCache = new Map<string, IPngCacheEntry>();

/**
 * Сохраняет изображение в кэш с ограничением размера
 * (вытесняет старейшую запись).
 */
function cachePng(key: string, buffer: Buffer, etag: string): void {
  if (pngCache.size >= PNG_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, v] of pngCache) {
      if (v.generatedAt < oldestTime) {
        oldestTime = v.generatedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      pngCache.delete(oldestKey);
    }
  }
  pngCache.set(key, { buffer, etag, generatedAt: Date.now() });
}

const app = express();

// Ограничение частоты запросов на генерацию изображений
const imageLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

// Healthcheck: статус сервиса и состояние кэшей
app.get("/health", (_req: Request, res: ExpressResponse) => {
  const raceCache = getRaceCache();
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    raceCache: raceCache
      ? { cached: true, fetchedAt: new Date(raceCache.fetchedAt).toISOString() }
      : { cached: false },
    pngCacheEntries: pngCache.size,
  });
});

app.get("/", imageLimiter, async (req: Request, res: ExpressResponse) => {
  // размеры с валидацией
  const width = parseDimension(queryString(req.query.width), DEFAULT_WIDTH) * SCALE;
  const height =
    parseDimension(queryString(req.query.height), DEFAULT_HEIGHT) * SCALE;

  const timezone = resolveTimezone(queryString(req.query.timezone));

  const showMap: boolean = queryString(req.query.showMap) === "true";
  const showPractise: boolean = queryString(req.query.showPractise) === "true";
  const showSprint: boolean = queryString(req.query.showSprint) === "true";
  const showQualification: boolean =
    queryString(req.query.showQualification) === "true";
  const showRace: boolean = queryString(req.query.showRace) === "true";
  const showCountDown: boolean = queryString(req.query.showCountDown) === "true";

  // ключ кэша учитывает все параметры, влияющие на картинку
  const cacheKey = [
    width,
    height,
    timezone,
    showMap,
    showPractise,
    showSprint,
    showQualification,
    showRace,
    showCountDown,
  ].join("|");

  // отдаём свежее изображение из кэша, если есть; поддерживаем ETag/304
  const cached = pngCache.get(cacheKey);
  if (cached) {
    res.set("ETag", `"${cached.etag}"`);
    res.set("Cache-Control", `public, max-age=${PNG_MAX_AGE_SECONDS}`);
    if (req.headers["if-none-match"] === `"${cached.etag}"`) {
      return res.status(304).end();
    }
    if (Date.now() - cached.generatedAt < PNG_CACHE_TTL_MS) {
      res.set("Content-Type", "image/png");
      return res.send(cached.buffer);
    }
  }

  // получаем данные о следующем гранпри
  let race: INormalizedRace | null;
  try {
    race = await fetchNextRace();
  } catch (error) {
    console.error("Failed to fetch race data:", error);
    // при сбое API отдаём устаревшие данные из кэша, если они есть
    const raceCache = getRaceCache();
    if (raceCache) {
      race = raceCache.race;
    } else {
      return res.status(502).send("Failed to fetch race data");
    }
  }

  if (!race) {
    return res.status(404).send("No upcoming race");
  }

  const buffer = await renderWallpaper(race, {
    width,
    height,
    timezone,
    showMap,
    showPractise,
    showSprint,
    showQualification,
    showRace,
    showCountDown,
  });

  const etag = createHash("sha1").update(buffer).digest("hex").slice(0, 16);

  cachePng(cacheKey, buffer, etag);

  res.set("Content-Type", "image/png");
  res.set("ETag", `"${etag}"`);
  res.set("Cache-Control", `public, max-age=${PNG_MAX_AGE_SECONDS}`);
  res.send(buffer);
});

app.listen(PORT, () => console.log("Server started"));
