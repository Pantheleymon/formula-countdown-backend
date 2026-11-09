// URL источника данных (Ergast-совместимый API)
export const API_URL = "https://api.jolpi.ca/ergast/f1/current/next.json";

// Время жизни кэша данных о гонке
export const API_CACHE_TTL_MS = 30 * 60 * 1000;

// Время жизни кэша сгенерированных изображений
export const PNG_CACHE_TTL_MS = 10 * 60 * 1000;

// Максимальное число записей в кэше изображений
export const PNG_CACHE_MAX_ENTRIES = 50;

// Таймаут запроса к API
export const FETCH_TIMEOUT_MS = 15 * 1000;

// Количество повторных попыток запроса к API
export const FETCH_RETRIES = 3;

// Базовая задержка между повторными попытками (экспоненциальный backoff)
export const FETCH_RETRY_BASE_DELAY_MS = 500;

// Масштаб отрисовки (для ретина-качества)
export const SCALE = 4;

// Размеры изображения по умолчанию (до масштабирования)
export const DEFAULT_WIDTH = 1060;
export const DEFAULT_HEIGHT = 1920;

// Допустимые границы размеров (до масштабирования)
export const MIN_DIMENSION = 200;
export const MAX_DIMENSION = 1920;

// Заголовок кэширования изображения (в секундах)
export const PNG_MAX_AGE_SECONDS = 600;

// Порт HTTP-сервера
export const PORT = 3000;

// Ограничение частоты запросов на генерацию изображений
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX = 30;

// Максимальное число одновременных генераций изображений
export const MAX_CONCURRENT_RENDERS = 3;

// Максимальное число вариантов карты трассы (-1, -2, -3, ...)
export const MAX_TRACK_VARIANTS = 10;
