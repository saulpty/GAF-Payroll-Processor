// Activity settings read from classification_config (category 'teramind'): the day thresholds and
// the trend minimums. Split out of useActivityData.ts on 2026-10-13 to keep that file under 15 KB.
import type { ActivitySettings } from '@/app/lib/activityDays';
import type { TrendMinimums } from '@/app/lib/activityTrend';
import { DEFAULT_TREND_MINIMUMS } from '@/app/lib/activityTrend';

export type ConfigRow = { key: string; value: string; label: string; description: string; category: string };

const FALLBACK_MIN_ACTIVE = 390;
const FALLBACK_BREAK = 60;
const FALLBACK_BREAK_OVER = 30;

export function parseSettings(rows: ConfigRow[]): { settings: ActivitySettings; fallbacks: string[] } {
  const teramind = rows.filter(r => r.category === 'teramind');
  const pick = (key: string) => teramind.find(r => r.key === key)?.value;
  const fallbacks: string[] = [];

  const minActive = Number(pick('activity_min_active_minutes'));
  const breakMin = Number(pick('activity_break_minutes'));
  const breakOver = Number(pick('activity_break_over_minutes'));

  if (!Number.isFinite(minActive) || minActive <= 0) fallbacks.push('activity_min_active_minutes');
  if (!Number.isFinite(breakMin)  || breakMin <= 0)  fallbacks.push('activity_break_minutes');
  if (!Number.isFinite(breakOver) || breakOver <= 0) fallbacks.push('activity_break_over_minutes');

  return {
    settings: {
      minActiveMinutes: (Number.isFinite(minActive) && minActive > 0) ? minActive : FALLBACK_MIN_ACTIVE,
      breakMinutes:     (Number.isFinite(breakMin)  && breakMin > 0)  ? breakMin  : FALLBACK_BREAK,
      breakOverMinutes: (Number.isFinite(breakOver) && breakOver > 0) ? breakOver : FALLBACK_BREAK_OVER,
    },
    fallbacks,
  };
}

const TREND_KEYS: [keyof TrendMinimums, string][] = [
  ['activeMinutes', 'activity_trend_min_active_minutes'],
  ['entryMinutes', 'activity_trend_min_entry_minutes'],
  ['days', 'activity_trend_min_days'],
  ['workedDays', 'activity_trend_min_worked_days'],
];

export function parseMinimums(rows: ConfigRow[]): { minimums: TrendMinimums; fallbacks: string[] } {
  const minimums: TrendMinimums = { ...DEFAULT_TREND_MINIMUMS };
  const fallbacks: string[] = [];
  for (const [field, key] of TREND_KEYS) {
    const n = Number(rows.find(r => r.category === 'teramind' && r.key === key)?.value);
    if (Number.isFinite(n) && n > 0) minimums[field] = n; else fallbacks.push(key);
  }
  return { minimums, fallbacks };
}
