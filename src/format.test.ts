import { describe, it, expect } from "vitest";
import {
  getCountdownLabel,
  formatSessionDate,
  formatSessionTime,
  formatCircuitLabel,
  getLabel,
} from "./format";

describe("getCountdownLabel", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const DAY = 1000 * 60 * 60 * 24;

  it("показывает несколько дней", () => {
    expect(
      getCountdownLabel(new Date(now.getTime() + 3 * DAY), now, "en-US"),
    ).toBe("in 3 days");
  });

  it("показывает один день в единственном числе", () => {
    expect(
      getCountdownLabel(new Date(now.getTime() + DAY), now, "en-US"),
    ).toBe("in 1 day");
  });

  it("показывает today для текущего момента", () => {
    expect(getCountdownLabel(now, now, "en-US")).toBe("today");
  });

  it("показывает ended для прошедшей сессии", () => {
    expect(
      getCountdownLabel(new Date(now.getTime() - 2 * DAY), now, "en-US"),
    ).toBe("ended");
  });

  it("локализует подписи на русский", () => {
    expect(
      getCountdownLabel(new Date(now.getTime() + 3 * DAY), now, "ru"),
    ).toBe("через 3 дня");
    expect(getCountdownLabel(now, now, "ru")).toBe("сегодня");
    expect(
      getCountdownLabel(new Date(now.getTime() - 2 * DAY), now, "ru"),
    ).toBe("завершено");
  });
});

describe("getLabel", () => {
  it("возвращает подпись по локали с фолбэком на английский", () => {
    expect(getLabel("en", "weekend")).toBe("WEEKEND");
    expect(getLabel("ru", "weekend")).toBe("УИКЕНД");
    expect(getLabel("fr", "schedule")).toBe("SCHEDULE");
  });
});

describe("formatCircuitLabel", () => {
  it("объединяет город, страну и название трассы", () => {
    const label = formatCircuitLabel({
      city: "Las Vegas",
      country: "USA",
      circuitName: "Las Vegas Strip Street Circuit",
    });
    expect(label).toBe(
      "LAS VEGAS, USA · LAS VEGAS STRIP STREET CIRCUIT",
    );
  });

  it("опускает пустые части", () => {
    const label = formatCircuitLabel({
      city: "",
      country: "USA",
      circuitName: "",
    });
    expect(label).toBe("USA");
  });
});

describe("formatSessionDate", () => {
  it("форматирует дату в UTC и переводит в верхний регистр", () => {
    const session = new Date("2026-11-22T04:00:00Z");
    expect(formatSessionDate(session, "UTC", "en-US")).toBe("NOV 22");
  });
});

describe("formatSessionTime", () => {
  it("форматирует время в UTC", () => {
    const session = new Date("2026-11-22T04:00:00Z");
    expect(formatSessionTime(session, "UTC", "ru")).toBe("04:00");
  });
});
