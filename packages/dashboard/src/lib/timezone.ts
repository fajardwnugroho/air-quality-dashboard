const STORAGE_KEY = 'pipefitter-timezone';

export interface TimezoneEntry {
  value: string;
  label: string;
  offset: string;
  offsetMinutes: number;
  abbreviation: string;
}

function parseOffsetMinutes(offset: string): number {
  const match = offset.match(/GMT([+-])(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
}

export function generateTimezoneList(): TimezoneEntry[] {
  const zones = Intl.supportedValuesOf('timeZone');
  const now = new Date();
  const list: TimezoneEntry[] = [];

  for (const tz of zones) {
    try {
      const offset =
        new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'longOffset',
        })
          .formatToParts(now)
          .find((p) => p.type === 'timeZoneName')?.value || 'GMT';

      const abbreviation =
        new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          timeZoneName: 'short',
        })
          .formatToParts(now)
          .find((p) => p.type === 'timeZoneName')
          ?.value?.replace(/\s+/g, '') || '';

      list.push({
        value: tz,
        label: `${offset}  ${tz}${abbreviation ? ` (${abbreviation})` : ''}`,
        offset,
        offsetMinutes: parseOffsetMinutes(offset),
        abbreviation,
      });
    } catch {
      // skip invalid timezone
    }
  }

  list.sort((a, b) => a.offsetMinutes - b.offsetMinutes);
  return list;
}

export function getStoredTimezone(): string {
  if (typeof window === 'undefined') return 'UTC';
  return localStorage.getItem(STORAGE_KEY) || 'UTC';
}

export function setStoredTimezone(tz: string): void {
  localStorage.setItem(STORAGE_KEY, tz);
}

export function formatInTimezone(iso: string | null, timezone: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
