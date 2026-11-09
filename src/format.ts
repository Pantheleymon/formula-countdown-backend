/**
 * Подписи интерфейса по локалям.
 */
export interface ILabels {
  weekend: string;
  schedule: string;
  today: string;
  ended: string;
}

const LABELS: Record<string, ILabels> = {
  en: { weekend: "WEEKEND", schedule: "SCHEDULE", today: "today", ended: "ended" },
  ru: { weekend: "УИКЕНД", schedule: "РАСПИСАНИЕ", today: "сегодня", ended: "завершено" },
};

const EN_LABELS = LABELS.en!;

/**
 * Возвращает подпись по ключу и локали (с фолбэком на английский).
 */
export function getLabel(locale: string, key: keyof ILabels): string {
  const lang = locale.split("-")[0] ?? "en";
  const labels = LABELS[lang] ?? EN_LABELS;
  return labels[key];
}

/**
 * Формирует подпись «город, страна · название трассы».
 */
export function formatCircuitLabel(circuit: {
  city: string;
  country: string;
  circuitName: string;
}): string {
  const location = [circuit.city, circuit.country].filter(Boolean).join(", ");
  return [location, circuit.circuitName]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();
}

/**
 * Формирует подпись обратного отсчёта до сессии.
 */
export function getCountdownLabel(
  sessionDate: Date,
  now: Date,
  locale: string,
): string {
  const diffTime = sessionDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
      diffDays,
      "day",
    );
  }
  if (diffDays === 0) {
    return getLabel(locale, "today");
  }
  return getLabel(locale, "ended");
}

/**
 * Форматирует дату сессии в заданном часовом поясе и локали.
 */
export function formatSessionDate(
  sessionDate: Date,
  timezone: string,
  locale: string,
): string {
  return sessionDate
    .toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      timeZone: timezone,
    })
    .toUpperCase();
}

/**
 * Форматирует время сессии в заданном часовом поясе и локали.
 */
export function formatSessionTime(
  sessionDate: Date,
  timezone: string,
  locale: string,
): string {
  return sessionDate.toLocaleTimeString([locale], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
}
