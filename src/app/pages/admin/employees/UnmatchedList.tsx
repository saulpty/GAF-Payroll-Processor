import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadMondayUnmatchedAction from '@/actions/loadMondayUnmatched';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import saveNameAliasAction from '@/actions/saveNameAlias';
import { normalizeName } from '@/app/lib/classificationEngine';

type UnmatchedRow = {
  source: string;
  monday_item_id: string;
  employee_name_raw: string;
  employee_email_raw: string;
  board_group: string;
  synced_at: string;
};

type EmpRow = {
  id: number;
  display_name: string;
  teramind_email: string;
  active: boolean;
};

type Group = {
  name: string;
  email: string;
  sources: Record<string, number>; // source -> count
  totalRows: number;
};

function norm(s: string) { return normalizeName(s ?? ''); }

/** Score how well candidateEmp name matches the unmatched full name (token overlap). */
function scoreMatch(empName: string, unmatchedName: string): number {
  const empTokens = norm(empName).split(/\s+/).filter(Boolean);
  const unmatchedTokens = new Set(norm(unmatchedName).split(/\s+/).filter(Boolean));
  if (empTokens.length === 0) return 0;
  // First token must match
  if (!unmatchedTokens.has(empTokens[0])) return 0;
  const matchCount = empTokens.filter(t => unmatchedTokens.has(t)).length;
  if (matchCount < 2) return 0;
  return matchCount;
}

function suggestEmployee(name: string, employees: EmpRow[]): EmpRow | null {
  let best: EmpRow | null = null;
  let bestScore = 0;
  let tied = false;
  for (const emp of employees) {
    if (!emp.active) continue;
    const s = scoreMatch(emp.display_name, name);
    if (s > bestScore) { best = emp; bestScore = s; tied = false; }
    else if (s === bestScore && s > 0) tied = true;
  }
  return (best && !tied) ? best : null;
}

const SOURCE_LABELS: Record<string, string> = {
  requests: 'Permissions',
  attendance_forms: 'Attendance',
  contracts: 'Contracts',
};

interface GroupRowProps {
  group: Group;
  employees: EmpRow[];
  onAliasAdded: (name: string) => void;
  onDismiss: (name: string) => void;
}

function GroupRow({ group, employees, onAliasAdded, onDismiss }: GroupRowProps) {
  const suggestion = useMemo(
    () => suggestEmployee(group.name, employees),
    [group.name, employees],
  );

  const [selectedId, setSelectedId] = useState<number | ''>(suggestion?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [saveAlias] = useMutateAction(saveNameAliasAction);

  // Keep combobox in sync if suggestion arrives after first render
  const prevSuggId = useMemo(() => suggestion?.id, [suggestion]);
  useMemo(() => {
    if (suggestion && selectedId === '') setSelectedId(suggestion.id);
  }, [prevSuggId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFirst = useMemo(
    () => [...employees].sort((a, b) =>
      a.active === b.active ? a.display_name.localeCompare(b.display_name)
        : a.active ? -1 : 1,
    ),
    [employees],
  );

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await saveAlias({ aliasText: group.name, employeeId: selectedId });
      setSaved(true);
      onAliasAdded(group.name);
    } finally {
      setSaving(false);
    }
  };

  if (saved) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-slate-800">{group.name}</span>
          {group.email && (
            <span className="font-mono text-xs text-slate-500">{group.email}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {Object.entries(group.sources).map(([src, count]) => (
            <span
              key={src}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
            >
              {SOURCE_LABELS[src] ?? src} ×{count}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : '')}
            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 max-w-[200px]"
          >
            <option value="">— choose employee —</option>
            {activeFirst.map(e => (
              <option key={e.id} value={e.id}>{e.display_name}</option>
            ))}
          </select>
          {suggestion && selectedId === suggestion.id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              suggested
            </span>
          )}
        </div>

        <Button
          size="sm"
          disabled={!selectedId || saving}
          onClick={handleSave}
          className="h-7 text-xs"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Add alias
        </Button>

        <button
          onClick={() => onDismiss(group.name)}
          className="text-[10px] text-slate-400 hover:text-slate-600 underline whitespace-nowrap"
        >
          Not an employee — hide
        </button>
      </div>
    </div>
  );
}

interface Props {
  refreshKey: number;
}

export default function UnmatchedList({ refreshKey }: Props) {
  const [rawRows, loading, , reload] = useLoadAction(
    loadMondayUnmatchedAction,
    [] as UnmatchedRow[],
  );
  const [empsRaw] = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);

  // Track dismissals and alias-saves in session state
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [aliasAdded, setAliasAdded] = useState<Set<string>>(new Set());

  // Reload when refreshKey changes
  const prevKey = useMemo(() => refreshKey, [refreshKey]);
  useMemo(() => { if (prevKey !== undefined) reload(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = rawRows as UnmatchedRow[];
  const employees = empsRaw as EmpRow[];

  const groups = useMemo((): Group[] => {
    const map = new Map<string, Group>();
    for (const r of rows) {
      const key = r.employee_name_raw ?? '';
      if (!map.has(key)) {
        map.set(key, { name: key, email: r.employee_email_raw ?? '', sources: {}, totalRows: 0 });
      }
      const g = map.get(key)!;
      g.sources[r.source] = (g.sources[r.source] ?? 0) + 1;
      g.totalRows++;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const visible = useMemo(() =>
    groups.filter(g => !dismissed.has(g.name) && !aliasAdded.has(g.name)),
    [groups, dismissed, aliasAdded],
  );

  const handleDismiss = (name: string) => setDismissed(p => new Set([...p, name]));
  const handleAliasAdded = (name: string) => {
    setAliasAdded(p => new Set([...p, name]));
  };

  const hasDismissed = dismissed.size + aliasAdded.size > 0;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Unmatched Board Rows</h3>
          <p className="text-xs text-muted-foreground">
            Board rows with no employee match.{' '}
            {visible.length === 0 && !loading
              ? ''
              : `${visible.length} group${visible.length !== 1 ? 's' : ''} · ${rows.length} rows total`}
          </p>
        </div>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>

      {!loading && visible.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Everything on the boards matches an employee.
          {hasDismissed && (
            <span className="text-xs text-muted-foreground ml-2">
              ({dismissed.size + aliasAdded.size} hidden this session)
            </span>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex flex-col gap-2">
          {visible.map(group => (
            <GroupRow
              key={group.name}
              group={group}
              employees={employees}
              onAliasAdded={handleAliasAdded}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-3">
        After adding an alias, press <em>Sync now</em> on the affected board(s) to re-match the rows.
        Use <em>Not an employee — hide</em> for managers or external contacts (e.g. Timothy Moore) whose data is not tracked.
      </p>
    </div>
  );
}
