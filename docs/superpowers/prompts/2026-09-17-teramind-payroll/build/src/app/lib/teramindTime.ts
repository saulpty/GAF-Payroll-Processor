// The only place in this app where a timezone conversion happens. Teramind's API
// returns login-session start timestamps in a format we have not confirmed yet, so
// this lib parses every plausible shape (ISO with Z/offset, epoch seconds/ms, or a
// naive "already Eastern" clock string) and turns it into US-Eastern wall-clock text
// `YYYY-MM-DD HH:MM:SS`. A wrong hour changes what people are paid, so correctness
// around DST matters more than anything else here.

const EPOCH_S_RE = /^\d{10}$/;
const EPOCH_MS_RE = /^\d{13}$/;
const INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,6}))?(Z|[+-]\d{2}:?\d{2})$/i;
const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/;

export function parseInstant(raw: string | number): number | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return null;
    const digits = Math.abs(raw).toString();
    if (EPOCH_S_RE.test(digits)) return raw * 1000;
    if (EPOCH_MS_RE.test(digits)) return raw;
    return null;
  }
  if (typeof raw !== 'string') return null;
  if (EPOCH_S_RE.test(raw)) return Number(raw) * 1000;
  if (EPOCH_MS_RE.test(raw)) return Number(raw);
  const m = INSTANT_RE.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac, offsetRaw] = m;
  const ms = frac ? Number((frac + '000').slice(0, 3)) : 0;
  let offsetMinutes = 0;
  if (offsetRaw.toUpperCase() !== 'Z') {
    const sign = offsetRaw[0] === '-' ? -1 : 1;
    const digitsOnly = offsetRaw.slice(1).replace(':', '');
    const oh = Number(digitsOnly.slice(0, 2));
    const om = Number(digitsOnly.slice(2, 4));
    offsetMinutes = sign * (oh * 60 + om);
  }
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0, ms);
  return base - offsetMinutes * 60000;
}

export function isNaiveClock(raw: string): boolean {
  return typeof raw === 'string' && NAIVE_RE.test(raw);
}

function normalizeNaiveClock(raw: string): string {
  const m = NAIVE_RE.exec(raw) as RegExpExecArray;
  const [, y, mo, d, h, mi, s] = m;
  return `${y}-${mo}-${d} ${h}:${mi}:${s ?? '00'}`;
}

let cachedFormatter: Intl.DateTimeFormat | null = null;
function getFormatter(): Intl.DateTimeFormat {
  if (!cachedFormatter) {
    cachedFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return cachedFormatter;
}

export function easternClock(ms: number): string {
  const parts = getFormatter().formatToParts(new Date(ms));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const hour = map.hour === '24' ? '00' : map.hour; // guard the hourCycle 'h23' midnight quirk
  return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}:${map.second}`;
}

export function easternDate(ms: number): string {
  return easternClock(ms).slice(0, 10);
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function addSecondsToClock(clock: string, seconds: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(clock) as RegExpExecArray;
  const [, y, mo, d, h, mi, s] = m;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const next = new Date(base + seconds * 1000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())} ${pad2(next.getUTCHours())}:${pad2(next.getUTCMinutes())}:${pad2(next.getUTCSeconds())}`;
}

export function addDays(ymd: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) as RegExpExecArray;
  const [, y, mo, d] = m;
  const base = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const next = new Date(base + n * 86400000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

export function hasTimezone(s: string): boolean {
  return /Z$/i.test(s) || /[T ]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2})/.test(s);
}

export function sessionClock(
  raw: string | number,
  durationS: number,
): { work_date: string; started_et: string; finished_et: string; started_raw: string } | null {
  const dur = Number.isFinite(durationS) && durationS > 0 ? Math.trunc(durationS) : 0;
  const ms = parseInstant(raw);
  if (ms !== null) {
    const started_et = easternClock(ms);
    const finished_et = easternClock(ms + dur * 1000);
    return { work_date: started_et.slice(0, 10), started_et, finished_et, started_raw: String(raw) };
  }
  if (typeof raw === 'string' && isNaiveClock(raw)) {
    const started_et = normalizeNaiveClock(raw);
    const finished_et = addSecondsToClock(started_et, dur);
    return { work_date: started_et.slice(0, 10), started_et, finished_et, started_raw: String(raw) };
  }
  return null;
}

/** Minutes since midnight, US Eastern, for an instant — "what time is it for the punches right now". */
export function easternMinutes(ms: number): number {
  const clock = easternClock(ms);
  return Number(clock.slice(11, 13)) * 60 + Number(clock.slice(14, 16));
}
