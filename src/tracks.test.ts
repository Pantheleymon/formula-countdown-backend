import { describe, it, expect } from "vitest";
import { normalizeCircuitId } from "./tracks";

describe("normalizeCircuitId", () => {
  it("применяет точное соответствие из таблицы", () => {
    expect(normalizeCircuitId("vegas")).toBe("las-vegas");
    expect(normalizeCircuitId("albert_park")).toBe("melbourne");
  });

  it("заменяет подчёркивания на дефисы", () => {
    expect(normalizeCircuitId("marina_bay")).toBe("marina-bay");
  });

  it("оставляет совпадающий id без изменений", () => {
    expect(normalizeCircuitId("monaco")).toBe("monaco");
  });
});
