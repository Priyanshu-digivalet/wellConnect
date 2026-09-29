export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? '0';
    return Number(value);
  };
  let hour = read('hour');
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

export function zonedTimeToUtc(
  parts: Pick<ZonedParts, 'year' | 'month' | 'day' | 'hour' | 'minute'>,
  timeZone: string,
): Date {
  const guess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0),
  );
  const offset = timeZoneOffsetMs(guess, timeZone);
  const corrected = new Date(guess.getTime() - offset);
  const secondOffset = timeZoneOffsetMs(corrected, timeZone);
  if (secondOffset !== offset) {
    return new Date(guess.getTime() - secondOffset);
  }
  return corrected;
}

export function isWithinQuietHours(
  now: Date,
  timeZone: string,
  quietStartHour: number,
  quietEndHour: number,
): boolean {
  const hour = getZonedParts(now, timeZone).hour;
  if (quietStartHour === quietEndHour) {
    return false;
  }
  if (quietStartHour < quietEndHour) {
    return hour >= quietStartHour && hour < quietEndHour;
  }
  return hour >= quietStartHour || hour < quietEndHour;
}

export function nextQuietHoursEnd(
  now: Date,
  timeZone: string,
  quietEndHour: number,
): Date {
  const parts = getZonedParts(now, timeZone);
  const candidate = {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: quietEndHour,
    minute: 0,
  };
  let end = zonedTimeToUtc(candidate, timeZone);
  if (end.getTime() <= now.getTime()) {
    const next = parseNextDay(parts);
    end = zonedTimeToUtc(
      { ...next, hour: quietEndHour, minute: 0 },
      timeZone,
    );
  }
  return end;
}

function parseNextDay(parts: ZonedParts): Pick<ZonedParts, 'year' | 'month' | 'day'> {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}
