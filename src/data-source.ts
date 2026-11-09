import {
  API_URL,
  API_CACHE_TTL_MS,
  FETCH_TIMEOUT_MS,
  FETCH_RETRIES,
  FETCH_RETRY_BASE_DELAY_MS,
} from "./config";
import { INormalizedRace, IErgastResponse, IErgastRace } from "./types";

// Кэш данных о ближайшей гонке
let raceCache: { race: INormalizedRace; fetchedAt: number } | null = null;

/** Ошибка, которую не нужно повторять (клиентская, 4xx). */
class NonRetryableError extends Error {}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Возвращает текущее состояние кэша данных гонки (для healthcheck
 * и fallback на устаревшие данные при сбое API).
 */
export function getRaceCache(): {
  race: INormalizedRace;
  fetchedAt: number;
} | null {
  return raceCache;
}

/**
 * Приводит объект гонки из Ergast-ответа к нормализованному виду.
 */
function normalizeRace(ergastRace: IErgastRace): INormalizedRace {
  return {
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
}

/**
 * Получает данные о ближайшей гонке с кэшированием, обработкой ошибок
 * и повторными попытками (экспоненциальный backoff) при сетевых сбоях
 * и ошибках 5xx/429.
 */
export async function fetchNextRace(): Promise<INormalizedRace | null> {
  if (raceCache && Date.now() - raceCache.fetchedAt < API_CACHE_TTL_MS) {
    return raceCache.race;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(API_URL, { signal: controller.signal });

      if (response.ok) {
        const data: IErgastResponse = await response.json();
        const ergastRace = data?.MRData?.RaceTable?.Races?.[0];

        // офф-сезон: гонки нет — это не ошибка
        if (!ergastRace) {
          return null;
        }

        const race = normalizeRace(ergastRace);
        raceCache = { race, fetchedAt: Date.now() };
        return race;
      }

      const statusError = new Error(`API вернул статус ${response.status}`);

      // 4xx (кроме 429) — клиентская ошибка, повторять бессмысленно
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        throw new NonRetryableError(statusError.message);
      }

      lastError = statusError;
    } catch (error) {
      if (error instanceof NonRetryableError) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < FETCH_RETRIES - 1) {
      await sleep(FETCH_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError ?? new Error("Ошибка запроса к API");
}
