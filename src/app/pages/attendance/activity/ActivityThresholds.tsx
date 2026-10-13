import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Settings2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { ActivitySettings } from '@/app/lib/activityDays';
import type { TrendMinimums } from '@/app/lib/activityTrend';
import upsertClassificationConfigAction from '@/actions/upsertClassificationConfig';

type Props = {
  settings: ActivitySettings;
  minimums: TrendMinimums;
  onSaved: () => Promise<void>;
};

// unit 'hours': stored in minutes, typed in hours. Any other unit is stored exactly as typed.
type Field = { key: string; label: string; description: string; unit: 'hours' | 'minutes' | 'days' };

const DAY_FIELDS: Field[] = [
  { key: 'activity_min_active_minutes', unit: 'hours', label: 'Minimum Active Time Per Full Day',
    description: 'Minutes of Teramind activity a full scheduled day must reach. Shorter shifts scale proportionally.' },
  { key: 'activity_break_minutes', unit: 'hours', label: 'Break Allowance',
    description: 'Minutes of break allowed in a day before the gap is counted against the employee.' },
  { key: 'activity_break_over_minutes', unit: 'hours', label: 'Flag Breaks Longer Than Allowance By',
    description: 'Minutes past the break allowance before a day is flagged as a long break.' },
];

const TREND_FIELDS: Field[] = [
  { key: 'activity_trend_min_active_minutes', unit: 'minutes', label: 'Average Active Time Must Move By',
    description: 'Minutes the average active time must change between the two periods before the Activity trend counts it.' },
  { key: 'activity_trend_min_entry_minutes', unit: 'minutes', label: 'Average Entry Must Move By',
    description: 'Minutes the average entry time must change between the two periods before the Activity trend counts it.' },
  { key: 'activity_trend_min_days', unit: 'days', label: 'Low or Missed Days Must Move By',
    description: 'Days the count of low-activity days, or of missed days, must change before the Activity trend counts it.' },
  { key: 'activity_trend_min_worked_days', unit: 'days', label: 'Days With Work Needed to Compare',
    description: 'Fewer days with work than this in either period shows Not enough data instead of a trend.' },
];

const ALL_FIELDS = [...DAY_FIELDS, ...TREND_FIELDS];

function startValues(settings: ActivitySettings, minimums: TrendMinimums): Record<string, string> {
  const hours = (minutes: number) => (minutes / 60).toFixed(1);
  return {
    activity_min_active_minutes: hours(settings.minActiveMinutes),
    activity_break_minutes: hours(settings.breakMinutes),
    activity_break_over_minutes: hours(settings.breakOverMinutes),
    activity_trend_min_active_minutes: String(minimums.activeMinutes),
    activity_trend_min_entry_minutes: String(minimums.entryMinutes),
    activity_trend_min_days: String(minimums.days),
    activity_trend_min_worked_days: String(minimums.workedDays),
  };
}

/** The number to store, or null when what was typed is not a positive number. */
function toStored(field: Field, typed: string): number | null {
  const n = parseFloat(typed);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Minutes and days are stored as typed: 2.5 days must not silently become 3.
  if (field.unit !== 'hours' && !Number.isInteger(n)) return null;
  const stored = field.unit === 'hours' ? Math.round(n * 60) : Math.round(n);
  return stored > 0 ? stored : null;
}

export default function ActivityThresholds({ settings, minimums, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [upsert] = useMutateAction(upsertClassificationConfigAction);

  function handleOpen() {
    setValues(startValues(settings, minimums));
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    const toSave: { field: Field; stored: number }[] = [];
    for (const field of ALL_FIELDS) {
      const stored = toStored(field, values[field.key] ?? '');
      if (stored === null) {
        setError('All values must be positive numbers. Minutes and days must be whole numbers.');
        return;
      }
      toSave.push({ field, stored });
    }

    setSaving(true);
    setError('');
    try {
      for (const { field, stored } of toSave) {
        await upsert({
          key: field.key,
          value: String(stored),
          label: field.label,
          description: field.description,
          value_type: 'number',
          category: 'teramind',
        });
      }
      await onSaved();
      setOpen(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const renderField = (field: Field) => (
    <div key={field.key}>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {field.label}
        <span className="ml-1 font-normal text-slate-400">({field.unit})</span>
      </label>
      <input
        type="number"
        min="0"
        step={field.unit === 'hours' ? '0.1' : '1'}
        value={values[field.key] ?? ''}
        onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
      >
        <Settings2 className="w-3.5 h-3.5" />
        Thresholds
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activity Thresholds</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500 mb-4">
            Applies to everyone. The minimum active time is scaled for a shorter shift.
          </p>

          <div className="space-y-4">{DAY_FIELDS.map(renderField)}</div>

          <h3 className="text-sm font-semibold text-slate-800 mt-6 mb-1">Trend Minimums</h3>
          <p className="text-xs text-slate-500 mb-4">
            How far a number must move between the two periods before the Trend column counts it as a change.
          </p>

          <div className="space-y-4">{TREND_FIELDS.map(renderField)}</div>

          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-warm text-warm-ink text-sm font-semibold hover:brightness-95 disabled:opacity-60 transition"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
