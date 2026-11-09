import { describe, it, expect } from "vitest";
import {
  queryString,
  parseDimension,
  resolveTimezone,
  resolveFormat,
  resolveLocale,
} from "./validation";

describe("queryString", () => {
  it("возвращает строку как есть", () => {
    expect(queryString("abc")).toBe("abc");
  });

  it("возвращает undefined для массива (повторяющийся параметр)", () => {
    expect(queryString(["a", "b"])).toBeUndefined();
  });

  it("возвращает undefined для нестроковых значений", () => {
    expect(queryString(undefined)).toBeUndefined();
    expect(queryString(123)).toBeUndefined();
  });
});

describe("parseDimension", () => {
  it("возвращает fallback при отсутствии значения", () => {
    expect(parseDimension(undefined, 1920)).toBe(1920);
  });

  it("возвращает корректное число", () => {
    expect(parseDimension("1080", 1920)).toBe(1080);
  });

  it("возвращает fallback для NaN", () => {
    expect(parseDimension("abc", 1920)).toBe(1920);
  });

  it("возвращает fallback для неположительных значений", () => {
    expect(parseDimension("-5", 1920)).toBe(1920);
    expect(parseDimension("0", 1920)).toBe(1920);
  });

  it("ограничивает сверху максимальным размером", () => {
    expect(parseDimension("99999", 1920)).toBe(1920);
  });

  it("ограничивает снизу минимальным размером", () => {
    expect(parseDimension("100", 1920)).toBe(200);
  });
});

describe("resolveFormat", () => {
  it("возвращает валидный формат", () => {
    expect(resolveFormat("png")).toBe("png");
    expect(resolveFormat("jpeg")).toBe("jpeg");
  });

  it("возвращает png при некорректном значении", () => {
    expect(resolveFormat("webp")).toBe("png");
    expect(resolveFormat("gif")).toBe("png");
    expect(resolveFormat(undefined)).toBe("png");
  });
});

describe("resolveLocale", () => {
  it("возвращает валидную локаль", () => {
    expect(resolveLocale("ru")).toBe("ru");
    expect(resolveLocale("en-GB")).toBe("en-GB");
  });

  it("возвращает en-US при некорректном значении", () => {
    expect(resolveLocale("not_a_locale")).toBe("en-US");
    expect(resolveLocale(undefined)).toBe("en-US");
  });
});

describe("resolveTimezone", () => {
  const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  it("возвращает валидный часовой пояс", () => {
    expect(resolveTimezone("Europe/Moscow")).toBe("Europe/Moscow");
  });

  it("возвращает серверный пояс при некорректном значении", () => {
    expect(resolveTimezone("Not/AZone")).toBe(serverTimezone);
  });

  it("возвращает серверный пояс при отсутствии значения", () => {
    expect(resolveTimezone(undefined)).toBe(serverTimezone);
  });
});
