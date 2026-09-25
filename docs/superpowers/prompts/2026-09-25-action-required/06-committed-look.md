# Action Required AR-6: the Committed section in the Warm look

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only `src/app/pages/action-required/ArCommitted.tsx` may change** (whole file below; same props
as before). No other file may be touched.

What changes: `Committed to Green` in Title Case; dates `Wed Sep 16`; "Was" as the Excel status
pill (`Red` / `Yellow`); impacts in plain text; `Updated` as `Fri Sep 25 · 6:58PM` (same stored
value, formatted); a warm hover on the revert button, which works exactly as before.

## `src/app/pages/action-required/ArCommitted.tsx` (whole file)

```tsx
import { CheckCircle2, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import type { CommittedRow } from './arTypes';

const THIS_YEAR = toLocalYMD(new Date()).slice(0, 4);
const th = 'px-3 py-2 text-left text-[12px] font-semibold text-slate-600 whitespace-nowrap bg-slate-50 border-b border-slate-200';
const td = 'px-3 py-2 border-b border-slate-100';
const WAS: Record<string, string> = {
  RED: 'bg-status-red-fill text-status-red-ink',
  YELLOW: 'bg-status-yellow-fill text-status-yellow-ink',
  GREEN: 'bg-status-green-fill text-status-green-ink',
};
const cap = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const dash = <span className="text-slate-300">—</span>;
/** "Fri Sep 25 · 6:58PM" from the stored updated_at text (no timezone conversion, as before). */
const fmtUpdated = (u: string | null | undefined) =>
  u ? `${fmtDay(u.slice(0, 10), THIS_YEAR)} · ${fmtTime(u.slice(11, 16))}` : '';

/** The "Committed to Green" list with per-row revert (AR-6: Warm look; open state stays in the page). */
export function ArCommitted({ committed, sessionCommitted, revertingIds, showPeriod, committedOpen, setCommittedOpen, onRevert }: {
  committed: CommittedRow[];
  sessionCommitted: Set<number>;
  revertingIds: Set<number>;
  showPeriod: boolean;
  committedOpen: boolean;
  setCommittedOpen: (f: (o: boolean) => boolean) => void;
  onRevert: (r: CommittedRow) => void;
}) {
  return (
    <div className="shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <button type="button" onClick={() => setCommittedOpen(o => !o)} aria-expanded={committedOpen}
        className="flex w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-status-green-ink" />
        <span className="text-[14px] font-semibold text-slate-800">Committed to Green</span>
        <span className="rounded-full bg-status-green-fill px-2 py-0.5 text-[12px] font-semibold tabular-nums text-status-green-ink">{committed.length}</span>
        {sessionCommitted.size > 0 && <span className="text-[12px] text-slate-500">{sessionCommitted.size} this session</span>}
        <ChevronRight className={`ml-auto w-4 h-4 text-slate-400 transition-transform ${committedOpen ? 'rotate-90' : ''}`} />
      </button>

      {committedOpen && (
        committed.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-slate-500">
            Nothing committed yet. Pick an event and impact above, then commit the row.
          </div>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-[13px] tabular-nums" style={{ minWidth: 980 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={th}>Employee</th>
                  {showPeriod && <th className={th}>Period</th>}
                  <th className={th}>Date</th>
                  <th className={th}>Was</th>
                  <th className={th}>Event 1</th>
                  <th className={th}>Impact 1</th>
                  <th className={th}>Event 2</th>
                  <th className={th}>Impact 2</th>
                  <th className={th}>Doc</th>
                  <th className={th}>Notes</th>
                  <th className={th}>Updated</th>
                  <th className={th}><span className="sr-only">Revert</span></th>
                </tr>
              </thead>
              <tbody>
                {committed.map(r => {
                  const isNew = sessionCommitted.has(r.id);
                  const reverting = revertingIds.has(r.id);
                  return (
                    <tr key={r.id} className={isNew ? 'bg-status-green-tint' : 'hover:bg-slate-50'}>
                      <td className={`${td} font-medium text-slate-800 whitespace-nowrap`}>
                        {isNew && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-status-green-ink align-middle" title="Committed this session" />}
                        {r.employee_name}
                      </td>
                      {showPeriod && <td className={`${td} whitespace-nowrap text-slate-600`}>{r.period_name}</td>}
                      <td className={`${td} whitespace-nowrap text-slate-700`}>{r.work_date ? fmtDay(r.work_date.slice(0, 10), THIS_YEAR) : dash}</td>
                      <td className={td}>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${WAS[r.initial_status] || ''}`}>{cap(r.initial_status)}</span>
                      </td>
                      <td className={`${td} text-slate-700`}>{r.event_type_1 || dash}</td>
                      <td className={`${td} text-slate-700`}>{r.pay_impact_1 || dash}</td>
                      <td className={`${td} text-slate-700`}>{r.event_type_2 || dash}</td>
                      <td className={`${td} text-slate-700`}>{r.pay_impact_2 || dash}</td>
                      <td className={`${td} text-slate-600`}>{r.documentation || dash}</td>
                      <td className={`${td} max-w-40 truncate text-slate-500`} title={r.notes || undefined}>{r.notes || dash}</td>
                      <td className={`${td} whitespace-nowrap text-[12px] text-slate-500`}>{fmtUpdated(r.updated_at)}</td>
                      <td className={`${td} text-center`}>
                        <button type="button" title={`Revert to ${cap(r.initial_status)}`} aria-label={`Revert ${r.employee_name} ${r.work_date?.slice(0, 10)} to ${cap(r.initial_status)}`}
                          disabled={reverting} onClick={() => onRevert(r)}
                          className="rounded-md p-1 text-slate-400 hover:bg-warm-tint hover:text-warm-text disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
                          {reverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
```

## Report
- Byte size of the file; confirm no other file changed.
