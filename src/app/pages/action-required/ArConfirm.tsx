import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EditState, EntryRow } from './arTypes';

/** Commit confirmation modal. Split out of ActionRequired.tsx, AR-1. */
export function ArConfirm({ toConfirm, getEdit, reasonFor = () => null, bulkSaving, onCancel, onConfirm }: {
  toConfirm: EntryRow[];
  getEdit: (row: EntryRow) => EditState;
  /** Why a row will be skipped (bad time, impact without event), or null. */
  reasonFor?: (row: EntryRow) => string | null;
  bulkSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const skipped = toConfirm.filter(r => reasonFor(r) !== null).length;
  const ready = toConfirm.length - skipped;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-border p-6 max-w-lg w-full mx-4">
        <h2 className="text-base font-bold mb-2">Confirm Commit</h2>
        <p className="text-sm text-muted-foreground mb-3">
          You are about to commit <span className="font-semibold text-foreground">{ready}</span> row(s) to GREEN.
          {skipped > 0 && <span className="text-red-700"> {skipped} will be skipped (see below).</span>}
        </p>
        <div className="max-h-40 overflow-y-auto border border-border rounded-lg mb-3">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Employee</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Date</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Event 1</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Pay Impact 1</th>
              </tr>
            </thead>
            <tbody>
              {toConfirm.map(row => {
                const edit = getEdit(row);
                const event1 = edit.event_type_1 || row.event_type_1;
                const impact1 = edit.pay_impact_1 || row.pay_impact_1;
                const reason = reasonFor(row);
                return (
                  <tr key={row.id} className={`border-b last:border-b-0 ${reason ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-1.5 font-medium">
                      {row.employee_name}
                      {reason && <div className="text-[10px] font-medium text-red-700">Skipped: {reason}</div>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-slate-600">{row.work_date.slice(0, 10)}</td>
                    <td className="px-3 py-1.5 text-slate-700">{event1 || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-1.5 text-blue-700 font-medium">{impact1 || <span className="text-slate-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          ⚠ This writes to the payroll record. Each row can be reverted individually from the Committed list below.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={bulkSaving || ready === 0} onClick={onConfirm}>
            {bulkSaving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Committing…</>
              : 'Confirm & Commit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
