import { describe, it, expect } from "vitest";
import {
  getCountdownLabel,
  formatSessionDate,
  formatSessionTime,
} from "./format";

describe("getCountdownLabel", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const DAY = 1000 * 60 * 60 * 24;

  it("показывает несколько дней", () => {
    expect(getCountdownLabel(new Date(now.getTime() + 3 * DAY), now)).toBe(
      "in 3 days",
    );
  });

  it("показывает один день в единственном числе", () => {
    expect(getCountdownLabel(new Date(now.getTime() + DAY), now)).toBe(
      "in 1 day",
    );
  });

  it("показывает today для текущего момента", () => {
    expect(getCountdownLabel(now, now)).toBe("today");
  });

  it("показывает ended для прошедшей сессии", () => {
    expect(getCountdownLabel(new Date(now.getTime() - 2 * DAY), now)).toBe(
      "ended",
    );
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
