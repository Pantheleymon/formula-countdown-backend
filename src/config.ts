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
