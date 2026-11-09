import path from "path";
import { createCanvas, registerFont, loadImage } from "canvas";
import type { Canvas } from "canvas";
import { SCALE } from "./config";
import { INormalizedRace, IRaceSchedule } from "./types";
import { normalizeCircuitId } from "./tracks";
import { getCountdownLabel, formatSessionDate, formatSessionTime } from "./format";

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

/**
 * Поддерживаемые форматы изображения
 */
export type ImageFormat = "png" | "jpeg";

const FORMAT_MIME: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
};

/**
 * Возвращает MIME-тип для формата изображения.
 */
export function getFormatMime(format: ImageFormat): string {
  return FORMAT_MIME[format];
}

/**
 * Параметры отрисовки обоев
 */
export interface IRenderOptions {
  width: number;
  height: number;
  timezone: string;
  format: ImageFormat;
  showMap: boolean;
  showPractise: boolean;
  showSprint: boolean;
  showQualification: boolean;
  showRace: boolean;
  showCountDown: boolean;
}

// порядок отображения сессий
const SESSION_ORDER: Array<keyof INormalizedRace["schedule"]> = [
  "fp1",
  "fp2",
  "fp3",
  "sprintQualy",
  "sprintRace",
  "qualy",
  "race",
];

/**
 * Отрисовывает обои с расписанием гонки и возвращает PNG-буфер.
 */
export async function renderWallpaper(
  race: INormalizedRace,
  options: IRenderOptions,
): Promise<Buffer> {
  const {
    width,
    height,
    timezone,
    format,
    showMap,
    showPractise,
    showSprint,
    showQualification,
    showRace,
    showCountDown,
  } = options;

  const currentDate: Date = new Date();

  // сортируем сессии в нужном порядке
  const sortedSchedule: IRaceSchedule[] = SESSION_ORDER.map(
    (item): IRaceSchedule => {
      return {
        type: item,
        date: race.schedule[item]?.date ?? "",
        time: race.schedule[item]?.time ?? "",
      };
    },
  );

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
      const label = getCountdownLabel(sessionDate, currentDate);
      ctx.font = `400 ${16 * SCALE}px Montserrat`;
      ctx.fillText(label, x + columnWidth * 6, y, columnWidth * 4);
    }

    y += 20 * SCALE;

    const formattedDate = formatSessionDate(sessionDate, timezone, "en-US");
    const formattedTime = formatSessionTime(sessionDate, timezone, "ru");

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

  return encodeCanvas(canvas, format);
}

/**
 * Кодирует канвас в буфер в заданном формате.
 */
function encodeCanvas(canvas: Canvas, format: ImageFormat): Buffer {
  if (format === "jpeg") {
    return canvas.toBuffer("image/jpeg", { quality: 0.9 });
  }
  return canvas.toBuffer("image/png");
}

/**
 * Параметры заглушки (изображение в офф-сезон).
 */
export interface IPlaceholderOptions {
  width: number;
  height: number;
  format: ImageFormat;
}

/**
 * Отрисовывает заглушку на случай, когда ближайшей гонки нет (офф-сезон).
 */
export function renderPlaceholder(options: IPlaceholderOptions): Buffer {
  const { width, height, format } = options;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.antialias = "subpixel";
  ctx.quality = "best";

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#888888";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `300 ${Math.round(width / 20)}px Montserrat`;
  ctx.fillText("NO UPCOMING RACE", width / 2, height / 2, width * 0.9);

  return encodeCanvas(canvas, format);
}
