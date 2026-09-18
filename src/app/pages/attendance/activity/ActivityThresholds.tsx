import { useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { Settings2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { ActivitySettings } from '@/app/lib/activityDays';
import upsertClassificationConfigAction from '@/actions/upsertClassificationConfig';

type Props = {
  settings: ActivitySettings;
  onSaved: () => Promise<void>;
};

const CONFIG_META: Record<string, { label: string; description: string }> = {
  activity_min_active_minutes: {
    label: 'Minimum Active Time Per Full Day',
    description: 'Minutes of Teramind activity a full scheduled day must reach. Shorter shifts scale proportionally.',
  },
  activity_break_minutes: {
    label: 'Break Allowance',
    description: 'Minutes of break allowed in a day before the gap is counted against the employee.',
  },
  activity_break_over_minutes: {
    label: 'Flag Breaks Longer Than Allowance By',
    description: 'Minutes past the break allowance before a day is flagged as a long break.',
  },
};

function toHours(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

function fromHours(hours: string): number {
  return Math.round(parseFloat(hours) * 60);
}

export default function ActivityThresholds({ settings, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [minActive, setMinActive] = useState('');
  const [breakAl, setBreakAl] = useState('');
  const [breakOver, setBreakOver] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [upsert] = useMutateAction(upsertClassificationConfigAction);

  function handleOpen() {
    setMinActive(toHours(settings.minActiveMinutes));
    setBreakAl(toHours(settings.breakMinutes));
    setBreakOver(toHours(settings.breakOverMinutes));
    setError('');
    setOpen(true);
  }

  async function handleSave() {
    const vals = [
      { key: 'activity_min_active_minutes', hours: minActive },
      { key: 'activity_break_minutes',      hours: breakAl },
      { key: 'activity_break_over_minutes', hours: breakOver },
    ];

    for (const v of vals) {
      const n = parseFloat(v.hours);
      if (!Number.isFinite(n) || n <= 0) {
        setError('All values must be positive numbers.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      for (const v of vals) {
        const meta = CONFIG_META[v.key];
        await upsert({
          key: v.key,
          value: String(fromHours(v.hours)),
          label: meta.label,
          description: meta.description,
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Activity Thresholds</DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500 mb-4">
            Applies to everyone. A shorter shift is scaled proportionally.
          </p>

          <div className="space-y-4">
            {([
              { key: 'activity_min_active_minutes', val: minActive, set: setMinActive },
              { key: 'activity_break_minutes',      val: breakAl,   set: setBreakAl },
              { key: 'activity_break_over_minutes', val: breakOver,  set: setBreakOver },
            ] as const).map(({ key, val, set }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {CONFIG_META[key].label}
                  <span className="ml-1 font-normal text-slate-400">(hours)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}
          </div>

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
              className="px-4 py-2 rounded-lg bg-[#2AA876] text-white text-sm font-medium hover:bg-[#25976a] disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
