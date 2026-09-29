const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = parseIsoDate(value);
  return formatIsoDate(parsed) === value;
}

export function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function inclusiveDayCount(from: string, to: string): number {
  const start = parseIsoDate(from).getTime();
  const end = parseIsoDate(to).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

export function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}
