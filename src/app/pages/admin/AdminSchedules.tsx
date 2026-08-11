import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Plus, Save, X, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TimeInput } from '@/app/components/TimeInput';
import loadSchedulesAction from '@/actions/loadSchedules';
import upsertScheduleAction from '@/actions/upsertSchedule';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';

type Schedule = {
  id: number;
  schedule_name: string;
  dst_start: string;
  dst_end: string;
  standard_start: string;
  standard_end: string;
  grace_minutes: number;
  work_days: string;
  notes: string;
};

type Employee = {
  id: number;
  display_name: string;
  schedule_name: string;
  schedule_id: number;
};

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type DayAbbr = typeof ALL_DAYS[number];

const DAY_LABELS: Record<DayAbbr, string> = {
  Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'Th', Fri: 'F', Sat: 'Sa', Sun: 'Su',
};

const DEFAULT_WORK_DAYS = 'Mon,Tue,Wed,Thu,Fri';

const EMPTY: Partial<Schedule> = {
  schedule_name: '',
  dst_start: '9:00 AM',
  dst_end: '5:00 PM',
  standard_start: '9:00 AM',
  standard_end: '5:00 PM',
  grace_minutes: 10,
  work_days: DEFAULT_WORK_DAYS,
  notes: '',
};

function WorkDayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const active = new Set(value.split(',').map(d => d.trim()).filter(Boolean));
  const toggle = (day: DayAbbr) => {
    const next = new Set(active);
    if (next.has(day)) next.delete(day); else next.add(day);
    onChange(ALL_DAYS.filter(d => next.has(d)).join(','));
  };
  return (
    <div className="flex gap-1 flex-wrap">
      {ALL_DAYS.map(day => (
        <button key={day} type="button" onClick={() => toggle(day)}
          className={`w-8 h-8 rounded text-xs font-semibold border transition-colors ${
            active.has(day)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-slate-500 border-slate-300 hover:border-blue-400'
          }`}>
          {DAY_LABELS[day]}
        </button>
      ))}
    </div>
  );
}

function WorkDayBadge({ value }: { value: string }) {
  const days = value ? value.split(',').map(d => d.trim()).filter(Boolean) : DEFAULT_WORK_DAYS.split(',');
  return (
    <div className="flex gap-0.5 flex-wrap">
      {ALL_DAYS.map(day => (
        <span key={day}
          className={`text-[10px] px-1 py-0.5 rounded font-medium ${
            days.includes(day) ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-300'
          }`}>
          {DAY_LABELS[day]}
        </span>
      ))}
    </div>
  );
}

/** Editing form state — uses a single start/end for the simple case,
 *  only exposes summer/winter split when the toggle is on. */
interface EditState extends Partial<Schedule> {
  _splitSeasons?: boolean;
}

export default function AdminSchedules() {
  const [schedules, , , reload] = useLoadAction(loadSchedulesAction, [] as Schedule[]);
  const [upsert, saving] = useMutateAction(upsertScheduleAction);
  const [allEmployees] = useLoadAction(loadAllEmployeesAction, [] as Employee[]);
  const [editing, setEditing] = useState<EditState | null>(null);

  const employees = allEmployees as Employee[];

  // Check if a schedule has genuinely different summer/winter times
  const hasDiffSeasons = (s: Partial<Schedule>) =>
    s.dst_start !== s.standard_start || s.dst_end !== s.standard_end;

  const openNew = () => {
    setEditing({ ...EMPTY, _splitSeasons: false });
  };

  const openEdit = (s: Schedule) => {
    setEditing({ ...s, _splitSeasons: hasDiffSeasons(s) });
  };

  const set = (key: keyof EditState, val: unknown) =>
    setEditing(prev => ({ ...prev!, [key]: val }));

  const handleSave = async () => {
    if (!editing) return;
    // When not split, mirror summer→winter
    const payload = { ...editing };
    if (!editing._splitSeasons) {
      payload.standard_start = editing.dst_start;
      payload.standard_end = editing.dst_end;
    }
    // Remove internal UI flag before sending
    const { _splitSeasons, ...clean } = payload;
    await upsert(clean);
    setEditing(null);
    await reload();
  };

  const inputCls = 'w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground max-w-2xl">
          Schedules define start/end times and which days count as workdays.
          Punches on non-scheduled days are silently ignored unless a form was submitted.
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />Add Schedule
        </Button>
      </div>

      {editing && (
        <Card className="mb-5 border-blue-300">
          <CardHeader>
            <CardTitle className="text-sm">{editing.id ? 'Edit Schedule' : 'New Schedule'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Schedule Name — dropdown from existing employees */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">
                  Schedule Name
                  <span className="text-muted-foreground font-normal ml-1">— pick an employee or type a custom name</span>
                </label>
                <div className="relative">
                  <input
                    list="employee-name-list"
                    className={inputCls}
                    value={editing.schedule_name || ''}
                    placeholder="e.g. Standard, Weekend Shift, John Doe"
                    onChange={e => set('schedule_name', e.target.value)}
                  />
                  <datalist id="employee-name-list">
                    {employees.map(e => (
                      <option key={e.id} value={e.display_name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Grace Period (minutes)</label>
                <input type="number" className={inputCls} min={0} max={60}
                  value={editing.grace_minutes ?? 10}
                  onChange={e => set('grace_minutes', Number(e.target.value))} />
              </div>
            </div>

            {/* Times */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium">
                  {editing._splitSeasons ? 'Summer (DST) Times' : 'Shift Times'}
                </span>
                <button
                  type="button"
                  onClick={() => set('_splitSeasons', !editing._splitSeasons)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  <ChevronDown className="w-3 h-3" />
                  {editing._splitSeasons ? 'Use same times year-round' : 'Different summer/winter times'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {editing._splitSeasons ? 'Summer Start (ET)' : 'Start Time (ET)'}
                  </label>
                  <TimeInput
                    value={editing.dst_start || ''}
                    onChange={v => set('dst_start', v)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    {editing._splitSeasons ? 'Summer End (ET)' : 'End Time (ET)'}
                  </label>
                  <TimeInput
                    value={editing.dst_end || ''}
                    onChange={v => set('dst_end', v)}
                    className={inputCls}
                  />
                </div>
              </div>

              {editing._splitSeasons && (
                <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-dashed">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Winter Start (ET)</label>
                    <TimeInput
                      value={editing.standard_start || ''}
                      onChange={v => set('standard_start', v)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Winter End (ET)</label>
                    <TimeInput
                      value={editing.standard_end || ''}
                      onChange={v => set('standard_end', v)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Working Days */}
            <div>
              <label className="text-xs font-medium block mb-1.5">Working Days</label>
              <WorkDayPicker
                value={editing.work_days ?? DEFAULT_WORK_DAYS}
                onChange={v => set('work_days', v)}
              />
              {(() => {
                const days = (editing.work_days ?? DEFAULT_WORK_DAYS).split(',').map(d => d.trim()).filter(Boolean);
                return (days.includes('Sat') || days.includes('Sun')) ? (
                  <p className="text-xs text-amber-600 mt-1.5">
                    ⚠ Weekend day(s) included — employees on this schedule are expected to work those days.
                  </p>
                ) : null;
              })()}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium block mb-1">Notes</label>
              <input className={inputCls} value={editing.notes || ''}
                onChange={e => set('notes', e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1" />Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                <X className="w-4 h-4 mr-1" />Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100">
            <tr>
              {['Name', 'Start', 'End', 'Winter Start', 'Winter End', 'Grace', 'Working Days', 'Notes', ''].map(h => (
                <th key={h} className="px-3 py-2 text-left border-b border-r last:border-r-0 font-semibold whitespace-nowrap text-xs">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(schedules as Schedule[]).map(s => {
              const diffSeasons = hasDiffSeasons(s);
              return (
                <tr key={s.id} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 border-r font-medium">{s.schedule_name}</td>
                  <td className="px-3 py-2 border-r">{s.dst_start}</td>
                  <td className="px-3 py-2 border-r">{s.dst_end}</td>
                  <td className={`px-3 py-2 border-r ${diffSeasons ? '' : 'text-slate-300 italic text-xs'}`}>
                    {diffSeasons ? s.standard_start : '—'}
                  </td>
                  <td className={`px-3 py-2 border-r ${diffSeasons ? '' : 'text-slate-300 italic text-xs'}`}>
                    {diffSeasons ? s.standard_end : '—'}
                  </td>
                  <td className="px-3 py-2 border-r text-center">{s.grace_minutes}</td>
                  <td className="px-3 py-2 border-r">
                    <WorkDayBadge value={s.work_days ?? DEFAULT_WORK_DAYS} />
                  </td>
                  <td className="px-3 py-2 border-r text-slate-500 text-xs max-w-[12rem] truncate">{s.notes}</td>
                  <td className="px-3 py-2 text-center">
                    <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => openEdit(s)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
