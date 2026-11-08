import express, { Request, Response as ExpressResponse } from "express";
import path from "path";
import { createHash } from "crypto";
import { createCanvas, registerFont, loadImage } from "canvas";

/**
 * Интерфейс для расписания сессий гранпри
 */
export interface IRaceSchedule {
  type: string;
  date: string;
  time: string;
}

/**
 * Типы ответа api.jolpi.ca (зеркало Ergast API)
 */
interface IErgastSession {
  date: string;
  time: string;
}

interface IErgastRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: {
      locality: string;
      country: string;
    };
  };
  FirstPractice?: IErgastSession;
  SecondPractice?: IErgastSession;
  ThirdPractice?: IErgastSession;
  Qualifying?: IErgastSession;
  Sprint?: IErgastSession;
  SprintQualifying?: IErgastSession;
}

interface IErgastResponse {
  MRData: {
    RaceTable: {
      Races: IErgastRace[];
    };
  };
}

/**
 * Нормализованные данные гонки, с которыми работает отрисовка
 */
interface INormalizedRace {
  round: string;
  raceName: string;
  circuit: {
    circuitId: string;
    circuitName: string;
    country: string;
    city: string;
  };
  schedule: {
    fp1: IErgastSession | null;
    fp2: IErgastSession | null;
    fp3: IErgastSession | null;
    sprintQualy: IErgastSession | null;
    sprintRace: IErgastSession | null;
    qualy: IErgastSession | null;
    race: IErgastSession;
  };
}

// URL источника данных (Ergast-совместимый API)
const API_URL = "https://api.jolpi.ca/ergast/f1/current/next.json";

// Время жизни кэша данных о гонке
const API_CACHE_TTL_MS = 30 * 60 * 1000;

// Время жизни кэша сгенерированных PNG
const PNG_CACHE_TTL_MS = 10 * 60 * 1000;

// Максимальное число записей в кэше PNG
const PNG_CACHE_MAX_ENTRIES = 50;

// Таймаут запроса к API
const FETCH_TIMEOUT_MS = 15 * 1000;

// Масштаб отрисовки (для ретина-качества)
const SCALE = 4;

// Размеры изображения по умолчанию (до масштабирования)
const DEFAULT_WIDTH = 1060;
const DEFAULT_HEIGHT = 1920;

// Допустимые границы размеров (до масштабирования)
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 1920;

// Заголовок кэширования PNG (в секундах)
const PNG_MAX_AGE_SECONDS = 600;

/**
 * Соответствие circuitId из Ergast/jolpi локальным файлам карт трасс.
 * В jolpi идентификаторы трасс отличаются от тех, что использовались
 * в f1api.dev (по которым названы файлы в src/tracks).
 */
const CIRCUIT_MAP_OVERRIDES: Record<string, string> = {
  albert_park: "melbourne",
  villeneuve: "montreal",
  red_bull_ring: "spielberg",
  spa: "spa-francorchamps",
  americas: "austin",
  rodriguez: "mexico-city",
  vegas: "las-vegas",
  losail: "lusail",
};

// Подключаем необходимые шрифты
registerFont(path.join(__dirname, "fonts/Montserrat-Regular-400.ttf"), {
  family: "Montserrat",
  weight: "400",
});

registerFont(path.join(__dirname, "fonts/Montserrat-Light-300.ttf"), {
  family: "Montserrat",
  weight: "300",
});

registerFont(path.join(__dirname, "fonts/Montserrat-Bold-700.ttf"), {
  family: "Montserrat",
  weight: "700",
});

// Кэш данных о ближайшей гонке
let raceCache: { race: INormalizedRace; fetchedAt: number } | null = null;

// Кэш сгенерированных PNG
interface IPngCacheEntry {
  buffer: Buffer;
  etag: string;
  generatedAt: number;
}
const pngCache = new Map<string, IPngCacheEntry>();

/**
 * Приводит circuitId из jolpi к имени локального файла карты трассы.
 * Сначала ищет точное соответствие в таблице, затем заменяет
 * подчёркивания на дефисы (marina_bay -> marina-bay и т.п.).
 */
function normalizeCircuitId(circuitId: string): string {
  return CIRCUIT_MAP_OVERRIDES[circuitId] ?? circuitId.replace(/_/g, "-");
}

/**
 * Извлекает строковое значение query-параметра (Express отдаёт массив
 * для повторяющихся параметров — берём только одиночную строку).
 */
function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Валидирует размер: целое число в допустимых границах, иначе значение
 * по умолчанию. Защищает от NaN/отрицательных/гигантских значений.
 */
function parseDimension(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.max(parsed, MIN_DIMENSION), MAX_DIMENSION);
}

/**
 * Проверяет валидность часового пояса (IANA-имя). При некорректном
 * значении возвращает часовой пояс сервера.
 */
function resolveTimezone(value: string | undefined): string {
  const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!value) {
    return serverTimezone;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return serverTimezone;
  }
}

/**
 * Сохраняет PNG в кэш с ограничением размера (вытесняет старейшую запись).
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

/**
 * Получает данные о ближайшей гонке с кэшированием и обработкой ошибок.
 */
async function fetchNextRace(): Promise<INormalizedRace | null> {
  if (raceCache && Date.now() - raceCache.fetchedAt < API_CACHE_TTL_MS) {
    return raceCache.race;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(API_URL, { signal: controller.signal });
  } catch (error) {
    throw new Error(`Ошибка запроса к API: ${(error as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`API вернул статус ${response.status}`);
  }

  const data: IErgastResponse = await response.json();
  const ergastRace = data?.MRData?.RaceTable?.Races?.[0];

  if (!ergastRace) {
    return null;
  }

  const race: INormalizedRace = {
    round: ergastRace.round,
    raceName: ergastRace.raceName,
    circuit: {
      circuitId: ergastRace.Circuit.circuitId,
      circuitName: ergastRace.Circuit.circuitName,
      country: ergastRace.Circuit.Location.country,
      city: ergastRace.Circuit.Location.locality,
    },
    schedule: {
      fp1: ergastRace.FirstPractice ?? null,
      fp2: ergastRace.SecondPractice ?? null,
      fp3: ergastRace.ThirdPractice ?? null,
      sprintQualy: ergastRace.SprintQualifying ?? null,
      sprintRace: ergastRace.Sprint ?? null,
      qualy: ergastRace.Qualifying ?? null,
      race: { date: ergastRace.date, time: ergastRace.time },
    },
  };

  raceCache = { race, fetchedAt: Date.now() };
  return race;
}

const app = express();

// Healthcheck: статус сервиса и состояние кэшей
app.get("/health", (_req: Request, res: ExpressResponse) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    raceCache: raceCache
      ? { cached: true, fetchedAt: new Date(raceCache.fetchedAt).toISOString() }
      : { cached: false },
    pngCacheEntries: pngCache.size,
  });
});

app.get("/", async (req: Request, res: ExpressResponse) => {
  // размеры с валидацией
  const width = parseDimension(queryString(req.query.width), DEFAULT_WIDTH) * SCALE;
  const height =
    parseDimension(queryString(req.query.height), DEFAULT_HEIGHT) * SCALE;

  const timezone = resolveTimezone(queryString(req.query.timezone));

  const currentDate: Date = new Date();

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

  // отдаём свежий PNG из кэша, если есть; поддерживаем ETag/304
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
    if (raceCache) {
      race = raceCache.race;
    } else {
      return res.status(502).send("Failed to fetch race data");
    }
  }

  if (!race) {
    return res.status(404).send("No upcoming race");
  }

  // порядок отображения сессий
  const order: Array<keyof INormalizedRace["schedule"]> = [
    "fp1",
    "fp2",
    "fp3",
    "sprintQualy",
    "sprintRace",
    "qualy",
    "race",
  ];

  // сортируем сессии в нужном порядке
  const sortedSchedule: IRaceSchedule[] = order.map((item): IRaceSchedule => {
    return {
      type: item,
      date: race?.schedule[item]?.date ?? "",
      time: race?.schedule[item]?.time ?? "",
    };
  });

  // ширина колонки для колоночной системы
  const columnWidth: number = width / 12;

  // создаем канвас и контекст для рисования
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // масштабируем и настраиваем канвас для лучшего качества
  ctx.antialias = "subpixel";
  ctx.patternQuality = "best";
  ctx.quality = "best";
  ctx.textDrawingMode = "path";

  ctx.imageSmoothingEnabled = true;

  // отступ для системных элементов
  let y = (height / 8) * 3;
  let x = columnWidth * 2;

  // фон
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  // цвет для текста
  ctx.fillStyle = "white";

  // название гранпри
  ctx.font = `300 ${10 * SCALE}px Montserrat`;
  ctx.fillText(
    `Round ${race.round} / ${race.raceName}`,
    x,
    y,
    columnWidth * 8,
  );

  y += 40 * SCALE;

  // заголовок "Weekend Schedule"
  ctx.font = `bold ${32 * SCALE}px Montserrat`;
  ctx.fillText("WEEKEND", x, y, columnWidth * 6);

  y += 30 * SCALE;

  ctx.font = `300 ${32 * SCALE}px Montserrat`;
  ctx.fillText("SCHEDULE", x, y, columnWidth * 6);

  // отображение карты трассы
  if (showMap) {
    const circuitId = normalizeCircuitId(race.circuit.circuitId);

    const circuitPath = path.join(__dirname, "tracks", `${circuitId}-1.png`);

    try {
      const circuitMap = await loadImage(circuitPath);
      ctx.drawImage(
        circuitMap,
        x + columnWidth * 6,
        y - 60 * SCALE,
        columnWidth * 2,
        columnWidth * 2,
      );
    } catch (error) {
      console.error("Failed to load circuit map:", error);
    }
  }

  y += 50 * SCALE;

  createRows();

  /**
   * Функция для создания строк сессий гранпри
   * @returns
   */
  function createRows(): void {
    // выводим расписание сессий
    sortedSchedule.forEach(({ type, date, time }) => {
      if (!date || !time) {
        return;
      }

      if (
        (type === "fp1" || type === "fp2" || type === "fp3") &&
        !showPractise
      ) {
        return;
      }
      if (type === "qualy" && !showQualification) {
        return;
      }
      if (type === "race" && !showRace) {
        return;
      }
      if ((type === "sprintRace" || type === "sprintQualy") && !showSprint) {
        return;
      }

      // тип сессии
      ctx.font = `bold ${24 * SCALE}px Montserrat`;
      ctx.fillText(type.toUpperCase(), x, y, columnWidth * 6);

      // дата и время сессии (в UTC-моменте)
      const sessionDate = new Date(`${date}T${time}`);

      if (showCountDown) {
        // сколько дней осталось до сессии
        const diffTime = sessionDate.getTime() - currentDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const label =
          diffDays > 0
            ? `in ${diffDays} day${diffDays > 1 ? "s" : ""}`
            : diffDays === 0
              ? "today"
              : "ended";

        ctx.font = `400 ${16 * SCALE}px Montserrat`;
        ctx.fillText(label, x + columnWidth * 6, y, columnWidth * 4);
      }

      y += 20 * SCALE;

      // форматируем дату в заданном часовом поясе
      const formattedDate = sessionDate
        .toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          timeZone: timezone,
        })
        .toUpperCase();

      // форматируем время в заданном часовом поясе
      const formattedTime = sessionDate.toLocaleTimeString(["ru"], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
      });

      // выводим дату и время
      ctx.font = `300 ${18 * SCALE}px Montserrat`;
      ctx.fillText(
        (formattedDate || "") + " - " + (formattedTime || ""),
        x,
        y,
        columnWidth * 6,
      );

      y += 45 * SCALE;
    });
  }

  // отправляем PNG
  const buffer = canvas.toBuffer("image/png");
  const etag = createHash("sha1").update(buffer).digest("hex").slice(0, 16);

  cachePng(cacheKey, buffer, etag);

  res.set("Content-Type", "image/png");
  res.set("ETag", `"${etag}"`);
  res.set("Cache-Control", `public, max-age=${PNG_MAX_AGE_SECONDS}`);
  res.send(buffer);
});

app.listen(3000, () => console.log("Server started"));
