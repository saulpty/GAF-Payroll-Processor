import { useState, useCallback } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import loadFloatingHolidaysAction from '@/actions/loadFloatingHolidays';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import upsertFloatingHolidayAction from '@/actions/upsertFloatingHoliday';
import { fhEligibleDate, fhRemaining } from '@/app/lib/ptoAccrual';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';

interface FhRow {
  employee_id: number;
  display_name: string;
  role: string | null;
  start_date: string | null;
  pto_start_date_override: string | null;
  fh_allocated: number;
  fh_used: number;
  notes: string | null;
  fh_requests: number | string;
}

const CUR_YEAR = new Date().getFullYear();

// Returns the local calendar day as YYYY-MM-DD (uses getFullYear/Month/Date, not UTC).
function todayStr(): string {
  return toLocalYMD(new Date());
}

function daysUntil(dateStr: string): number {
  // Days between today and a future YYYY-MM-DD — only used for display, not a clock time.
  const t = toLocalYMD(new Date());
  const [ty, tm, td] = t.split('-').map(Number);
  const [ey, em, ed] = dateStr.split('-').map(Number);
  return Math.round(
    (Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86400000,
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <Info className="w-3 h-3 text-slate-400 cursor-help ml-0.5" />
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10
        w-56 rounded bg-slate-800 text-white text-[11px] px-2 py-1.5 leading-snug shadow-lg whitespace-normal">
        {text}
      </span>
    </span>
  );
}

interface EditCell {
  employee_id: number;
  field: 'fh_used' | 'notes';
  value: string;
}

export default function FloatingHolidaysTab() {
  const { manager } = useGlobalFilters();
  const [year, setYear] = useState(CUR_YEAR);
  const [refreshKey, setRefreshKey] = useState(0);
  const [edit, setEdit] = useState<EditCell | null>(null);
  const [saving, setSaving] = useState<number | null>(null); // employee_id being saved

  const [upsert] = useMutateAction(upsertFloatingHolidayAction);

  const [rawRows, loading, error, reload] = useLoadAction(
    loadFloatingHolidaysAction,
    [] as FhRow[],
    { year, manager: manager || null },
    { enabled: true },
  );

  // refreshKey triggers reload when incremented
  void refreshKey;

  const rows = rawRows as FhRow[];
  const today = todayStr();

  const startEdit = useCallback((employee_id: number, field: 'fh_used' | 'notes', value: string) => {
    setEdit({ employee_id, field, value });
  }, []);

  const commitEdit = useCallback(async (row: FhRow) => {
    if (!edit || edit.employee_id !== row.employee_id) return;
    const newUsed  = edit.field === 'fh_used'  ? Number(edit.value)  : row.fh_used;
    const newNotes = edit.field === 'notes'     ? edit.value          : (row.notes ?? '');
    setEdit(null);

    // Only write if something changed
    const usedChanged  = edit.field === 'fh_used'  && newUsed  !== row.fh_used;
    const notesChanged = edit.field === 'notes'    && newNotes !== (row.notes ?? '');
    if (!usedChanged && !notesChanged) return;

    setSaving(row.employee_id);
    try {
      await upsert({
        employee_id:   row.employee_id,
        calendar_year: year,
        fh_allocated:  row.fh_allocated,
        fh_used:       newUsed,
        notes:         newNotes || null,
      });
      setRefreshKey(k => k + 1);
      await reload();
    } finally {
      setSaving(null);
    }
  }, [edit, upsert, year, reload]);

  const yearOptions: number[] = [];
  for (let y = CUR_YEAR + 1; y >= CUR_YEAR - 2; y--) yearOptions.push(y);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Floating Holidays</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            2 per calendar year · non-stacking · eligible 90 days after hire
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500" htmlFor="fh-year">Year</label>
          <select
            id="fh-year"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error.message}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-center py-10 text-sm text-slate-400">
            No active employees found.
          </CardContent>
        </Card>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="text-left py-2 px-3 font-medium">Employee</th>
                <th className="text-left py-2 px-3 font-medium">Title</th>
                <th className="text-left py-2 px-3 font-medium">Start</th>
                <th className="text-left py-2 px-3 font-medium">Eligible date</th>
                <th className="text-left py-2 px-3 font-medium">Eligible?</th>
                <th className="text-right py-2 px-3 font-medium">Allocated</th>
                <th className="text-right py-2 px-3 font-medium">Used</th>
                <th className="text-right py-2 px-3 font-medium">Remaining</th>
                <th className="text-right py-2 px-3 font-medium">
                  Requests
                  <Tooltip text="Requests on Monday are informational only. 'Used' is what Tim records in this ledger." />
                </th>
                <th className="text-left py-2 px-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const effectiveStart = (row.pto_start_date_override ?? row.start_date ?? '').slice(0, 10);
                const hasStart = effectiveStart.length === 10;
                const eligibleDate = hasStart ? fhEligibleDate(effectiveStart) : null;
                const isEligible  = eligibleDate !== null && eligibleDate <= today;
                const daysLeft    = eligibleDate !== null && !isEligible ? daysUntil(eligibleDate) : 0;
                const remaining   = fhRemaining(row.fh_allocated, row.fh_used);
                const isSaving    = saving === row.employee_id;

                const editingUsed  = edit?.employee_id === row.employee_id && edit.field === 'fh_used';
                const editingNotes = edit?.employee_id === row.employee_id && edit.field === 'notes';

                return (
                  <tr key={row.employee_id} className={`border-b border-slate-100 hover:bg-slate-50 ${isSaving ? 'opacity-60' : ''}`}>
                    <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">{row.display_name}</td>
                    <td className="py-2 px-3 text-slate-500">{row.role ?? '—'}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {hasStart ? effectiveStart : (
                        <span className="text-amber-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> —
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-600">
                      {eligibleDate ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-3">
                      {eligibleDate === null ? (
                        <span className="text-slate-400">—</span>
                      ) : isEligible ? (
                        <span className="text-green-700 font-medium">✔</span>
                      ) : (
                        <span className="text-amber-600">⏳ in {daysLeft}d</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">{row.fh_allocated}</td>

                    {/* Used — inline edit */}
                    <td className="py-2 px-3 text-right">
                      {editingUsed ? (
                        <Input
                          type="number" min={0} max={row.fh_allocated} step={1}
                          value={edit!.value}
                          autoFocus
                          onChange={e => setEdit({ ...edit!, value: e.target.value })}
                          onBlur={() => commitEdit(row)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(null); }}
                          className="h-6 w-14 text-right px-1 text-xs"
                        />
                      ) : (
                        <button
                          className="min-w-[2rem] text-right px-1 rounded hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-300"
                          onClick={() => startEdit(row.employee_id, 'fh_used', String(row.fh_used))}
                          disabled={isSaving}
                        >
                          {row.fh_used}
                        </button>
                      )}
                    </td>

                    <td className={`py-2 px-3 text-right font-medium ${remaining > 0 ? 'text-green-700' : 'text-slate-400'}`}>
                      {remaining}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{Number(row.fh_requests)}</td>

                    {/* Notes — inline edit */}
                    <td className="py-2 px-3 max-w-[180px]">
                      {editingNotes ? (
                        <Input
                          value={edit!.value}
                          autoFocus
                          onChange={e => setEdit({ ...edit!, value: e.target.value })}
                          onBlur={() => commitEdit(row)}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEdit(null); }}
                          className="h-6 text-xs px-1"
                        />
                      ) : (
                        <button
                          className="w-full text-left truncate rounded hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-300 px-1"
                          onClick={() => startEdit(row.employee_id, 'notes', row.notes ?? '')}
                          disabled={isSaving}
                        >
                          {row.notes ?? <span className="text-slate-300">add note</span>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
