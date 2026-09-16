const MS_MINUTE = 60_000;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

export function toIso(date: Date): string {
  return date.toISOString();
}

export function parseIso(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function epochSecondsToDate(epochSeconds: number): Date {
  return new Date(epochSeconds * 1000);
}

export function formatDurationUntil(target: Date, now: Date): string {
  const delta = target.getTime() - now.getTime();
  if (delta <= 0) {
    return "elapsed";
  }
  return formatDuration(delta);
}

export function formatDuration(ms: number): string {
  const abs = Math.max(0, Math.floor(ms));
  const days = Math.floor(abs / MS_DAY);
  const hours = Math.floor((abs % MS_DAY) / MS_HOUR);
  const minutes = Math.floor((abs % MS_HOUR) / MS_MINUTE);
  if (days > 0) {
    return `${days}d ${pad2(hours)}h`;
  }
  return `${pad2(hours)}h ${pad2(minutes)}m`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

export function isStale(capturedAt: string, now: Date, maxAgeMs: number): boolean {
  const captured = parseIso(capturedAt);
  if (!captured) {
    return true;
  }
  return now.getTime() - captured.getTime() > maxAgeMs;
}
