import express from "express";
import path from "path";
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
const CACHE_TTL_MS = 30 * 60 * 1000;

// Таймаут запроса к API
const FETCH_TIMEOUT_MS = 15 * 1000;

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

/**
 * Приводит circuitId из jolpi к имени локального файла карты трассы.
 * Сначала ищет точное соответствие в таблице, затем заменяет
 * подчёркивания на дефисы (marina_bay -> marina-bay и т.п.).
 */
function normalizeCircuitId(circuitId: string): string {
  return CIRCUIT_MAP_OVERRIDES[circuitId] ?? circuitId.replace(/_/g, "-");
}

/**
 * Получает данные о ближайшей гонке с кэшированием и обработкой ошибок.
 */
async function fetchNextRace(): Promise<INormalizedRace | null> {
  if (raceCache && Date.now() - raceCache.fetchedAt < CACHE_TTL_MS) {
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

app.get(
  "/",
  async (
    req: {
      query: {
        height?: string;
        width?: string;
        showMap?: string;
        showPractise?: string;
        showSprint?: string;
        showQualification?: string;
        showRace?: string;
        showCountDown?: string;
      };
    },
    res: any,
  ) => {
    const scale = 4;

    const height: number =
      (req.query?.height ? parseInt(req.query?.height) : 1920) * scale;
    const width: number =
      (req.query?.width ? parseInt(req.query?.width) : 1060) * scale;

    const currentDate: Date = new Date();

    const showMap: boolean = req.query?.showMap === "true";
    const showPractise: boolean = req.query?.showPractise === "true";
    const showSprint: boolean = req.query?.showSprint === "true";
    const showQualification: boolean = req.query?.showQualification === "true";
    const showRace: boolean = req.query?.showRace === "true";
    const showCountDown: boolean = req.query?.showCountDown === "true";

    // получаем данные о следующем гранпри
    let race: INormalizedRace | null;
    try {
      race = await fetchNextRace();
    } catch (error) {
      console.error("Failed to fetch race data:", error);
      return res.status(502).send("Failed to fetch race data");
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

    // TODO: Добавить отображение страны и автодрома
    // const circuitName = circuit?.circuitName;
    // const country = circuit?.country;

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
    ctx.font = `300 ${10 * scale}px Montserrat`;
    ctx.fillText(
      `Round ${race.round} / ${race.raceName}`,
      x,
      y,
      columnWidth * 8,
    );

    y += 40 * scale;

    // заголовок "Weekend Schedule"
    ctx.font = `bold ${32 * scale}px Montserrat`;
    ctx.fillText("WEEKEND", x, y, columnWidth * 6);

    y += 30 * scale;

    ctx.font = `300 ${32 * scale}px Montserrat`;
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
          y - 60 * scale,
          columnWidth * 2,
          columnWidth * 2,
        );
      } catch (error) {
        console.error("Failed to load circuit map:", error);
      }
    }

    y += 50 * scale;

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
        ctx.font = `bold ${24 * scale}px Montserrat`;
        ctx.fillText(type.toUpperCase(), x, y, columnWidth * 6);

        // дата и время сессии
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

          ctx.font = `400 ${16 * scale}px Montserrat`;
          ctx.fillText(label, x + columnWidth * 6, y, columnWidth * 4);
        }

        y += 20 * scale;

        // форматируем дату
        const formattedDate = new Date(date)
          .toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
          })
          .toUpperCase();

        // форматируем время
        const formattedTime = sessionDate.toLocaleTimeString(["ru"], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        // выводим дату и время
        ctx.font = `300 ${18 * scale}px Montserrat`;
        ctx.fillText(
          (formattedDate || "") + " - " + (formattedTime || ""),
          x,
          y,
          columnWidth * 6,
        );

        y += 45 * scale;
      });
    }

    // отправляем PNG
    const buffer = canvas.toBuffer("image/png");

    res.set("Content-Type", "image/png");
    res.send(buffer);
  },
);

app.listen(3000, () => console.log("Server started"));
