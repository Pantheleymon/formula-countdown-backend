/**
 * Формирует подпись обратного отсчёта до сессии.
 */
export function getCountdownLabel(sessionDate: Date, now: Date): string {
  const diffTime = sessionDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
  }
  if (diffDays === 0) {
    return "today";
  }
  return "ended";
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
