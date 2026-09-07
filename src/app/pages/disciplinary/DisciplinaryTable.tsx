import { useState, useMemo, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useLoadAction } from '@uibakery/data';
import DataTable, { Col } from '@/app/components/DataTable';
import EmptyState from '@/app/components/EmptyState';
import DisciplinaryRow, { DisciplinaryRowData, DISCIPLINARY_COL_COUNT } from './DisciplinaryRow';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import loadDisciplinaryActionsAction from '@/actions/loadDisciplinaryActions';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import {
  groupByEmployee,
  sortEmployeeCases,
  caseState,
} from '@/app/lib/disciplinary';
import type { DisciplinaryRow as DisciplinaryRowType } from '@/app/lib/disciplinary';
import { buildResolver } from '@/app/lib/mondayResolve';
import type { ResolvableEmployee, ResolvableAlias } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
import type { SortDir } from '@/app/lib/ptoSort';

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const COLUMNS: Col<DisciplinaryRowData>[] = [
  { key: 'displayName',  label: 'Employee',      align: 'left' },
  {
    key: 'manager',
    label: 'Manager',
    align: 'left',
    tip: 'The manager who filed this disciplinary action — not the employee\'s current roster manager. They may differ.',
  },
  { key: 'actions',      label: 'Actions',       align: 'right', sortable: false },
  { key: 'highestRank',  label: 'Highest level', align: 'left',  sortable: false },
  { key: 'escalation',   label: 'Escalation',    align: 'left',  sortable: false },
  { key: 'latest',       label: 'Latest',        align: 'left',  sortable: false },
  { key: 'worstState',   label: 'Status',        align: 'left',  sortable: false },
  { key: '_expand',      label: '',              align: 'center', sortable: false, width: '36px' },
];

// Verify col count constant stays in sync
const _check: number = COLUMNS.length;
void (_check === DISCIPLINARY_COL_COUNT);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  asOf: string;
  statusFilter: 'all' | 'open' | 'overdue' | 'closed';
  onRowsChange?: (rows: DisciplinaryRowData[]) => void;
  onCountsChange?: (c: { employees: number; actions: number; open: number }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DisciplinaryTable({ asOf, statusFilter, onRowsChange, onCountsChange }: Props) {
  const { employee, role, manager } = useGlobalFilters();

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);

  // ── Data loads ────────────────────────────────────────────────────────────

  const [rawRows, loading, error, reload] = useLoadAction(
    loadDisciplinaryActionsAction,
    [] as DisciplinaryRowType[],
    { manager: manager || null, employeeName: null },
  );

  const [empsRaw] = useLoadAction(loadAllEmployeesAction, []);
  const [aliasesRaw] = useLoadAction(loadNameAliasesAction, []);

  // ── Sort handler ─────────────────────────────────────────────────────────

  const handleSort = (k: string) => {
    if (k === sortKey) {
      const d = nextSortDir(sortDir);
      setSortDir(d);
      if (d === null) setSortKey(null);
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  // ── Resolver ─────────────────────────────────────────────────────────────

  const emps = empsRaw as ResolvableEmployee[];
  const aliases = aliasesRaw as ResolvableAlias[];

  const resolver = useMemo(
    () => buildResolver(emps, aliases, normalizeName),
    [emps, aliases],
  );

  const empById = useMemo(
    () => new Map(emps.map(e => [e.id, e])),
    [emps],
  );

  // ── Stage 1: Normalise timestamps, group by employee, build DisciplinaryRowData ──

  const derived = useMemo((): DisciplinaryRowData[] => {
    // Slice timestamps to 10 chars — closed_at is TIMESTAMPTZ.
    const normalised = (rawRows as DisciplinaryRowType[]).map(r => ({
      ...r,
      document_date:    r.document_date    ? r.document_date.slice(0, 10)    : null,
      revaluation_date: r.revaluation_date ? r.revaluation_date.slice(0, 10) : null,
      closed_at:        r.closed_at        ? r.closed_at.slice(0, 10)        : null,
    }));

    const groups = groupByEmployee(normalised, asOf);

    return groups.map(group => {
      const { employeeName, actions, latest } = group;
      const employeeId = resolver(employeeName, null);
      const matched = employeeId !== null ? empById.get(employeeId) : null;

      const onRoster = employeeId !== null;
      const displayName = matched ? matched.display_name : employeeName;
      // active: false only when we matched a real employee marked inactive.
      // Unmatched rows are treated as active so they don't get muted/hidden.
      const active = matched ? (matched as { active: boolean }).active !== false : true;

      // Role: roster role when non-empty string, else form's own employee_role.
      const rosterRole = matched ? ((matched as { role?: string }).role ?? '') : '';
      const role = rosterRole.trim() !== '' ? rosterRole : (latest.employee_role ?? '');

      // Branch: always from the action (roster has no branch column).
      const branch = latest.employee_branch ?? '';

      // Manager: from the disciplinary record (not roster).
      const mgr = latest.manager_name ?? '';

      return {
        ...group,
        employeeId,
        displayName,
        role,
        branch,
        manager: mgr,
        active,
        onRoster,
      };
    });
  }, [rawRows, asOf, resolver, empById]);

  // ── Stage 2: Filter ───────────────────────────────────────────────────────

  const filtered = useMemo((): DisciplinaryRowData[] => {
    let rows = derived;

    if (employee) {
      const q = employee.toLowerCase();
      rows = rows.filter(r => r.displayName.toLowerCase().includes(q));
    }

    if (role) {
      const q = role.toLowerCase();
      rows = rows.filter(r => r.role.toLowerCase().includes(q));
    }

    if (statusFilter === 'open') {
      rows = rows.filter(r =>
        r.worstState === 'open' || r.worstState === 'outcome' || r.worstState === 'overdue',
      );
    } else if (statusFilter === 'overdue') {
      rows = rows.filter(r => r.worstState === 'overdue');
    } else if (statusFilter === 'closed') {
      rows = rows.filter(r => r.worstState === 'closed');
    }
    // 'all' keeps everything

    return rows;
  }, [derived, employee, role, statusFilter]);

  // ── Stage 3: Sort ─────────────────────────────────────────────────────────

  const sorted = useMemo((): DisciplinaryRowData[] => {
    if (!sortKey || !sortDir) {
      return sortEmployeeCases(filtered) as DisciplinaryRowData[];
    }
    return sortRows(filtered, sortKey as keyof DisciplinaryRowData, sortDir, 'displayName');
  }, [filtered, sortKey, sortDir]);

  // ── Report counts ─────────────────────────────────────────────────────────

  useEffect(() => {
    const actions = sorted.reduce((sum, r) => sum + r.actions.length, 0);
    const open = sorted.reduce((sum, r) => {
      const openInGroup = r.actions.filter(
        a => caseState(a, asOf) !== 'closed',
      ).length;
      return sum + openInGroup;
    }, 0);
    onRowsChange?.(sorted);
    onCountsChange?.({ employees: sorted.length, actions, open });
  }, [sorted, asOf, onRowsChange, onCountsChange]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-6 mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-3">
        <span>Couldn&apos;t load disciplinary actions — loadDisciplinaryActions</span>
        <button
          type="button"
          onClick={reload}
          className="ml-auto rounded px-2 py-1 text-red-700 border border-red-300 hover:bg-red-100 text-xs focus-visible:ring-2 focus-visible:ring-primary/30 focus:outline-none"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <DataTable
      columns={COLUMNS}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      stickyHeader
      className="mx-6 mb-6 max-h-[calc(100vh-240px)]"
    >
      {sorted.length === 0 ? (
        <tr>
          <td colSpan={COLUMNS.length} className="p-0">
            <EmptyState
              title="No employees match"
              hint="Try clearing the search or filters."
              compact
            />
          </td>
        </tr>
      ) : (
        sorted.map(row => (
          <DisciplinaryRow
            key={row.employeeName}
            row={row}
            asOf={asOf}
            expanded={expandedName === row.employeeName}
            onToggle={() =>
              setExpandedName(prev =>
                prev === row.employeeName ? null : row.employeeName,
              )
            }
            onChanged={reload}
          />
        ))
      )}
    </DataTable>
  );
}
