import { API_URL, API_CACHE_TTL_MS, FETCH_TIMEOUT_MS } from "./config";
import { INormalizedRace, IErgastResponse } from "./types";

// Кэш данных о ближайшей гонке
let raceCache: { race: INormalizedRace; fetchedAt: number } | null = null;

/**
 * Возвращает текущее состояние кэша данных гонки (для healthcheck
 * и fallback на устаревшие данные при сбое API).
 */
export function getRaceCache(): { race: INormalizedRace; fetchedAt: number } | null {
  return raceCache;
}

/**
 * Получает данные о ближайшей гонке с кэшированием и обработкой ошибок.
 */
export async function fetchNextRace(): Promise<INormalizedRace | null> {
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
