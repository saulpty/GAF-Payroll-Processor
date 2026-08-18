import { useMemo, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Loader2 } from 'lucide-react';
import loadDirectoryReconciliationAction from '@/actions/loadDirectoryReconciliation';
import { Resolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';

export type DirectoryItem = {
  item_id: string;
  name: string;
  email: string;
  role: string;
  manager: string;
  active: string;
};

type EmpRow = {
  employee_id: number;
  display_name: string;
  teramind_email: string;
  role: string;
  manager: string;
  active: boolean;
};

type Filter = 'all' | 'mismatches' | 'not-on-monday';

function norm(s: string | null | undefined) { return normalizeName(s ?? ''); }

function MatchCell({
  ours, monday, label,
}: { ours: string; monday: string; label: string }) {
  const match = norm(ours) === norm(monday);
  if (match) return <span title={`${label}: ${ours || '—'}`}>✅</span>;
  return (
    <span
      className="cursor-help"
      title={`ours: ${ours || '—'} · Monday: ${monday || '—'}`}
    >⚠️</span>
  );
}

const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  mismatches: 'Only mismatches',
  'not-on-monday': 'Not on Monday',
};

interface Props {
  mondayDirectory: DirectoryItem[];
  resolver: Resolver;
  refreshKey: number;
}

export default function ReconciliationTable({ mondayDirectory, resolver, refreshKey }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const [empsRaw, loading] = useLoadAction(
    loadDirectoryReconciliationAction,
    [] as EmpRow[],
    { manager: '' },
    { enabled: true },
  );
  // reload when refreshKey changes
  const _rk = refreshKey; // referenced to ensure dep; actual reload on mount suffices

  const emps = empsRaw as EmpRow[];

  // Build lookup: employee_id -> Monday item (by email, then by name)
  const mondayByEmail = useMemo(() => {
    const m = new Map<string, DirectoryItem>();
    for (const d of mondayDirectory) if (d.email) m.set(d.email.toLowerCase(), d);
    return m;
  }, [mondayDirectory]);

  const mondayByNormName = useMemo(() => {
    const m = new Map<string, DirectoryItem>();
    for (const d of mondayDirectory) m.set(norm(d.name), d);
    return m;
  }, [mondayDirectory]);

  const rows = useMemo(() => emps.map(emp => {
    const byEmail = emp.teramind_email
      ? mondayByEmail.get(emp.teramind_email.toLowerCase())
      : undefined;
    const byName = mondayByNormName.get(norm(emp.display_name));
    const mItem = byEmail ?? byName ?? null;

    const emailOk   = mItem ? norm(mItem.email) === norm(emp.teramind_email) : false;
    const roleOk    = mItem ? norm(mItem.role) === norm(emp.role) : false;
    const managerOk = mItem ? norm(mItem.manager) === norm(emp.manager) : false;
    const activeOk  = mItem
      ? (mItem.active === 'Active') === emp.active
      : false;
    const hasMismatch = mItem && (!emailOk || !roleOk || !managerOk || !activeOk);

    return { emp, mItem, emailOk, roleOk, managerOk, activeOk, hasMismatch };
  }), [emps, mondayByEmail, mondayByNormName]);

  const mismatches    = rows.filter(r => r.hasMismatch).length;
  const notOnMonday   = rows.filter(r => !r.mItem).length;

  const filtered = useMemo(() => {
    if (filter === 'mismatches') return rows.filter(r => r.hasMismatch);
    if (filter === 'not-on-monday') return rows.filter(r => !r.mItem);
    return rows;
  }, [rows, filter]);

  if (mondayDirectory.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic mt-6 px-1">
        Press <span className="font-medium not-italic">Sync now</span> on the Employee Directory card to compare.
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Directory Reconciliation</h3>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {emps.length} employees · {mismatches} mismatches · {notOnMonday} not on Monday
      </p>

      {/* Filter chips */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
              filter === f
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Employee</th>
              <th className="px-3 py-2 text-left font-medium">Email</th>
              <th className="px-3 py-2 text-center font-medium">Email ✓</th>
              <th className="px-3 py-2 text-center font-medium">Role ✓</th>
              <th className="px-3 py-2 text-center font-medium">Manager ✓</th>
              <th className="px-3 py-2 text-center font-medium">Active ✓</th>
              <th className="px-3 py-2 text-center font-medium">Monday?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(({ emp, mItem, emailOk, roleOk, managerOk, activeOk }) => (
              <tr key={emp.employee_id} className="hover:bg-slate-50">
                <td className="px-3 py-1.5 font-medium text-slate-800">{emp.display_name}</td>
                <td className="px-3 py-1.5 font-mono text-slate-500 max-w-[180px] truncate">
                  {emp.teramind_email || '—'}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {mItem
                    ? <MatchCell ours={emp.teramind_email} monday={mItem.email} label="Email" />
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {mItem
                    ? <MatchCell ours={emp.role} monday={mItem.role} label="Role" />
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {mItem
                    ? <MatchCell ours={emp.manager} monday={mItem.manager} label="Manager" />
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {mItem
                    ? <MatchCell
                        ours={emp.active ? 'Active' : 'Inactive'}
                        monday={mItem.active}
                        label="Active"
                      />
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-1.5 text-center">
                  {mItem ? '✅' : <span title="Not found in Monday directory">❌</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground italic">
                  No rows match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Read-only. Fix role/manager/active via <em>Sync now</em> on Directory; fix email via the Roster tab.
      </p>
    </div>
  );
}
