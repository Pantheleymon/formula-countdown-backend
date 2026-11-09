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

/**
 * Приводит circuitId из jolpi к имени локального файла карты трассы.
 * Сначала ищет точное соответствие в таблице, затем заменяет
 * подчёркивания на дефисы (marina_bay -> marina-bay и т.п.).
 */
export function normalizeCircuitId(circuitId: string): string {
  return CIRCUIT_MAP_OVERRIDES[circuitId] ?? circuitId.replace(/_/g, "-");
}
