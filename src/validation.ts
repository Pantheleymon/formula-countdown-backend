import { MIN_DIMENSION, MAX_DIMENSION } from "./config";
import { ImageFormat } from "./renderer";

/**
 * Извлекает строковое значение query-параметра (Express отдаёт массив
 * для повторяющихся параметров — берём только одиночную строку).
 */
export function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * Валидирует размер: целое число в допустимых границах, иначе значение
 * по умолчанию. Защищает от NaN/отрицательных/гигантских значений.
 */
export function parseDimension(value: string | undefined, fallback: number): number {
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
 * Проверяет валидность формата изображения. При некорректном значении
 * возвращает "png".
 */
export function resolveFormat(value: string | undefined): ImageFormat {
  if (value === "jpeg" || value === "png") {
    return value;
  }
  return "png";
}

/**
 * Проверяет валидность локали. При некорректном значении возвращает "en-US".
 */
export function resolveLocale(value: string | undefined): string {
  if (!value) {
    return "en-US";
  }
  try {
    new Intl.DateTimeFormat(value);
    return value;
  } catch {
    return "en-US";
  }
}

/**
 * Проверяет валидность часового пояса (IANA-имя). При некорректном
 * значении возвращает часовой пояс сервера.
 */
export function resolveTimezone(value: string | undefined): string {
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
