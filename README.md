# Formula Countdown Backend

Сервис для генерации обоев (wallpaper) для iPhone с информацией о ближайшем
Гран-при Формулы-1: название гонки, расписание сессий уикенда, обратный отсчёт
до старта и карта трассы.

Картинка рисуется на `canvas` и отдаётся как PNG. Источник данных —
[api.jolpi.ca](https://api.jolpi.ca) (зеркало Ergast API).

## Запуск

```bash
npm install
npm run build
npm start          # сервер на http://localhost:3000
```

Для разработки с автоперезагрузкой:

```bash
npm run dev
```

## Тесты

```bash
npm test
```

## Endpoint'ы

### `GET /` — обои

Генерирует PNG-обои с расписанием ближайшей гонки.

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `width` | число | `1060` | Ширина (до масштабирования, диапазон 200–1920) |
| `height` | число | `1920` | Высота (до масштабирования, диапазон 200–1920) |
| `timezone` | IANA-имя | часовой пояс сервера | Пояс, в котором показывать время сессий |
| `showMap` | `true`/`false` | `false` | Показывать карту трассы |
| `showPractise` | `true`/`false` | `false` | Показывать практики (FP1–FP3) |
| `showSprint` | `true`/`false` | `false` | Показывать спринт и спринт-квалификацию |
| `showQualification` | `true`/`false` | `false` | Показывать квалификацию |
| `showRace` | `true`/`false` | `false` | Показывать гонку |
| `showCountDown` | `true`/`false` | `false` | Показывать обратный отсчёт до сессии |

Пример:

```
http://localhost:3000/?showMap=true&showPractise=true&showQualification=true&showRace=true&showCountDown=true&timezone=Europe/Moscow
```

Ответ содержит заголовки `ETag` и `Cache-Control` и поддерживает `If-None-Match`
(`304 Not Modified`).

### `GET /health` — состояние сервиса

Возвращает JSON со статусом, аптаймом и состоянием кэшей.

## Структура проекта

```
src/
  config.ts        — константы (URL, TTL, размеры, порт)
  types.ts         — типы данных (Ergast-ответ, нормализованная гонка)
  format.ts        — форматирование дат/времени и обратный отсчёт
  validation.ts    — валидация query-параметров
  tracks.ts        — маппинг circuitId в имена файлов карт трасс
  data-source.ts   — получение данных с кэшированием и обработкой ошибок
  renderer.ts      — отрисовка обоев на canvas
  index.ts         — HTTP-сервер и маршруты
```

## Офф-сезон и ошибки

- Если API недоступен, но данные гонки уже были получены ранее — сервис
  отдаёт их из кэша.
- Если ближайшей гонки нет (офф-сезон) — возвращается `404`.
