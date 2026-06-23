import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import {
  AlertTriangle, CheckCircle, Loader2, ChevronUp, ChevronDown,
  ChevronsUpDown, Search, X, Edit2, GitCommit, ChevronRight,
  Square, CheckSquare, Send, ClipboardList, RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimeInput } from '@/app/components/TimeInput';
import loadActionRequiredAction from '@/actions/loadActionRequired';
import loadCommittedEntriesAction from '@/actions/loadCommittedEntries';
import updatePayrollEntryAction from '@/actions/updatePayrollEntry';
import updateEntryExitAction from '@/actions/updateEntryExit';
import loadEventTypeRulesAction from '@/actions/loadEventTypeRules';
import loadPayImpactsAction from '@/actions/loadPayImpacts';
import loadDocumentationOptionsAction from '@/actions/loadDocumentationOptions';
import loadEventTypesAction from '@/actions/loadEventTypes';
import loadUnresolvedCountAction from '@/actions/loadUnresolvedCount';
import { computeDerivedFields } from '@/app/lib/classificationEngine';

type EntryRow = {
  id: number; period_name: string; employee_name: string; work_date: string;
  entry_time: string | null; exit_time: string | null;
  scheduled_start: string; grace_until: string; scheduled_end: string;
  late_minutes: number; late_after_grace: number; early_leave_minutes: number;
  discount_total_minutes: number; payroll_ready: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string; auto_notes: string;
  initial_status: string; status_current: string;
};

type CommittedRow = {
  id: number; employee_name: string; work_date: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string; auto_notes: string;
  initial_status: string; status_current: string;
  discount_total_minutes: number; updated_at: string;
};

type EditState = {
  entry_time: string; exit_time: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string;
};

type SortDir = 'asc' | 'desc' | null;
type SortKey = keyof EntryRow | null;

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-blue-600" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-blue-600" />;
}

// Fields that broadcast to all selected rows when changed
const BROADCAST_FIELDS: (keyof EditState)[] = [
  'event_type_1', 'pay_impact_1', 'event_type_2', 'pay_impact_2', 'documentation',
];

const STATUS_CHIP: Record<string, string> = {
  RED:    'bg-[#FFC7CE] text-red-800 border-red-300',
  YELLOW: 'bg-[#FFEB9C] text-yellow-800 border-yellow-300',
  GREEN:  'bg-[#C6EFCE] text-green-800 border-green-300',
};

// Visual select that glows when it will broadcast to multiple rows
function BroadcastSelect({ value, options, placeholder, broadcasting, onChange }: {
  value: string;
  options: string[];
  placeholder: string;
  broadcasting: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        className={`w-full border rounded px-1.5 py-1 text-xs bg-white transition-colors ${
          broadcasting
            ? 'border-blue-400 ring-1 ring-blue-300 bg-blue-50'
            : ''
        }`}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {broadcasting && (
        <span
          title={`Will apply to all selected rows`}
          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border border-white text-white flex items-center justify-center text-[8px] font-bold leading-none pointer-events-none"
        >
          ↗
        </span>
      )}
    </div>
  );
}

export default function ActionRequired() {
  const { period: selectedPeriod, employee: globalEmployee } = useGlobalFilters();
  const [payImpacts] = useLoadAction(loadPayImpactsAction, [] as { name: string }[]);
  const [docOptions] = useLoadAction(loadDocumentationOptionsAction, [] as { name: string }[]);
  const [eventTypes] = useLoadAction(loadEventTypesAction, [] as { id: number; name: string }[]);
  const [unresolvedData] = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);
  const [eventRulesRaw] = useLoadAction(loadEventTypeRulesAction, [] as { event_type: string; default_pay_impact: string; default_doc_option: string }[]);

  const [params, setParams] = useState({ periodName: selectedPeriod });
  const [rows, loading, , reload] = useLoadAction(loadActionRequiredAction, [] as EntryRow[], params, { enabled: !!params.periodName });
  const [committedRows, , , reloadCommitted] = useLoadAction(loadCommittedEntriesAction, [] as CommittedRow[], params, { enabled: !!params.periodName });
  const [updateEntry, saving] = useMutateAction(updatePayrollEntryAction);
  const [updateTimes] = useMutateAction(updateEntryExitAction);

  const [activeTab, setActiveTab] = useState<'RED' | 'YELLOW'>('RED');
  const [edits, setEdits] = useState<Record<number, EditState>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [committedOpen, setCommittedOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  // Track IDs committed this session for highlighting
  const [sessionCommitted, setSessionCommitted] = useState<Set<number>>(new Set());
  const [revertingIds, setRevertingIds] = useState<Set<number>>(new Set());

  const unresolvedCount = (unresolvedData as { count: number }[])[0]?.count ?? 0;
  const impactOptions = (payImpacts as { name: string }[]).map(p => p.name);
  const docOpts = (docOptions as { name: string }[]).map(d => d.name);
  const eventOpts = (eventTypes as { name: string }[]).map(e => e.name);

  const rulesMap = useMemo(() => {
    const m = new Map<string, { pay_impact: string; doc_option: string }>();
    for (const r of eventRulesRaw) {
      m.set(r.event_type, { pay_impact: r.default_pay_impact || '', doc_option: r.default_doc_option || '' });
    }
    return m;
  }, [eventRulesRaw]);

  // Sync params when global period changes
  useEffect(() => {
    setParams({ periodName: selectedPeriod });
    setEdits({});
    setSelected(new Set());
    setSessionCommitted(new Set());
    setSearch('');
    setSortKey(null);
    setSortDir(null);
  }, [selectedPeriod]);

  const getEdit = useCallback((row: EntryRow): EditState =>
    edits[row.id] ?? {
      entry_time: row.entry_time || '',
      exit_time: row.exit_time || '',
      event_type_1: row.event_type_1 || '',
      pay_impact_1: row.pay_impact_1 || '',
      event_type_2: row.event_type_2 || '',
      pay_impact_2: row.pay_impact_2 || '',
      documentation: row.documentation || '',
      notes: row.notes || '',
    }, [edits]);

  const setEditField = useCallback((id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => {
    const isBroadcast = BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1;
    const targetIds = isBroadcast ? Array.from(selected) : [id];
    const rowMap = new Map((allRows ?? []).map(r => [r.id, r]));

    setEdits(prev => {
      const next = { ...prev };
      for (const tid of targetIds) {
        const trow = rowMap.get(tid) ?? row;
        const current = { ...getEdit(trow), ...prev[tid] };
        const updated = { ...current, [field]: value };
        if (field === 'event_type_1' && value && rulesMap.has(value)) {
          const rule = rulesMap.get(value)!;
          if (!current.pay_impact_1 && rule.pay_impact) updated.pay_impact_1 = rule.pay_impact;
          if (!current.documentation && rule.doc_option) updated.documentation = rule.doc_option;
        }
        if (field === 'event_type_2' && value && rulesMap.has(value)) {
          const rule = rulesMap.get(value)!;
          if (!current.pay_impact_2 && rule.pay_impact) updated.pay_impact_2 = rule.pay_impact;
        }
        next[tid] = updated;
      }
      return next;
    });
    // auto-select the touched row
    setSelected(prev => new Set(prev).add(id));
  }, [edits, getEdit, rulesMap, selected]);

  const isDirty = useCallback((row: EntryRow): boolean => {
    if (!edits[row.id]) return false;
    const e = edits[row.id];
    return (
      e.event_type_1 !== (row.event_type_1 || '') ||
      e.pay_impact_1 !== (row.pay_impact_1 || '') ||
      e.event_type_2 !== (row.event_type_2 || '') ||
      e.pay_impact_2 !== (row.pay_impact_2 || '') ||
      e.documentation !== (row.documentation || '') ||
      e.notes !== (row.notes || '') ||
      e.entry_time !== (row.entry_time || '') ||
      e.exit_time !== (row.exit_time || '')
    );
  }, [edits]);

  // Save a single row, returns derived status
  const saveRow = async (row: EntryRow): Promise<string> => {
    const edit = getEdit(row);
    const derived = computeDerivedFields({
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      late_minutes: row.late_minutes, late_after_grace: row.late_after_grace,
      early_leave_minutes: row.early_leave_minutes, initial_status: row.initial_status,
    });
    const timesChanged = edit.entry_time !== (row.entry_time || '') || edit.exit_time !== (row.exit_time || '');
    if (timesChanged) await updateTimes({ id: row.id, entry_time: edit.entry_time || null, exit_time: edit.exit_time || null });
    await updateEntry({
      id: row.id,
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      documentation: edit.documentation, notes: edit.notes,
      discount_total_minutes: derived.discount_total_minutes,
      payroll_ready: derived.payroll_ready, status_current: derived.status_current,
    });
    return derived.status_current;
  };

  // Bulk commit selected rows
  const handleBulkCommit = async () => {
    const toSave = filtered.filter(r => selected.has(r.id));
    if (!toSave.length) return;
    setBulkSaving(true);
    const newCommitted = new Set(sessionCommitted);
    for (const row of toSave) {
      await saveRow(row);
      newCommitted.add(row.id);
    }
    setSessionCommitted(newCommitted);
    setSelected(new Set());
    setBulkSaving(false);
    await reload();
    await reloadCommitted();
  };

  const handleRevert = async (r: CommittedRow) => {
    setRevertingIds(prev => new Set(prev).add(r.id));
    try {
      await updateEntry({
        id: r.id,
        event_type_1: r.event_type_1,
        pay_impact_1: r.pay_impact_1,
        event_type_2: r.event_type_2,
        pay_impact_2: r.pay_impact_2,
        documentation: r.documentation,
        notes: r.notes,
        discount_total_minutes: r.discount_total_minutes,
        payroll_ready: 'NO',
        status_current: r.initial_status,
      });
      setSessionCommitted(prev => { const s = new Set(prev); s.delete(r.id); return s; });
      await reload();
      await reloadCommitted();
    } finally {
      setRevertingIds(prev => { const s = new Set(prev); s.delete(r.id); return s; });
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else { setSortKey(key); setSortDir('asc'); }
  };

  const allRows = rows as EntryRow[];
  const redRows = allRows.filter(r => r.initial_status === 'RED');
  const yellowRows = allRows.filter(r => r.initial_status === 'YELLOW');
  const tabRows = activeTab === 'RED' ? redRows : yellowRows;

  const filtered = useMemo(() => {
    let out = tabRows;
    const searchTerm = search.trim() || globalEmployee.trim();
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      out = out.filter(r => r.employee_name.toLowerCase().includes(q) || r.work_date.toLowerCase().includes(q));
    }
    if (sortKey && sortDir) {
      out = [...out].sort((a, b) => {
        const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [tabRows, search, sortKey, sortDir]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const someSelected = filtered.some(r => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(r => s.delete(r.id)); return s; });
      setLastSelectedIndex(null);
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(r => s.add(r.id)); return s; });
      setLastSelectedIndex(filtered.length - 1);
    }
  };

  const toggleRow = (id: number, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex !== null) {
      const lo = Math.min(index, lastSelectedIndex);
      const hi = Math.max(index, lastSelectedIndex);
      const rangeIds = filtered.slice(lo, hi + 1).map(r => r.id);
      // If the anchor was selected, select the range; otherwise deselect
      const anchorSelected = selected.has(filtered[lastSelectedIndex]?.id);
      setSelected(prev => {
        const s = new Set(prev);
        rangeIds.forEach(rid => anchorSelected ? s.add(rid) : s.delete(rid));
        return s;
      });
    } else {
      setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
      setLastSelectedIndex(index);
    }
  };

  const committed = committedRows as CommittedRow[];
  const selectedCount = filtered.filter(r => selected.has(r.id)).length;

  const Th = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r last:border-r-0 cursor-pointer select-none hover:bg-slate-200 transition-colors ${className}`}
      onClick={() => col && handleSort(col)}
    >
      {label}{col && <SortIcon col={col as string} sortKey={sortKey} sortDir={sortDir} />}
    </th>
  );

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0" />
          <h1 className="text-xl font-bold">Action Required</h1>
          {unresolvedCount > 0 && <Badge variant="destructive" className="text-xs">{unresolvedCount} unresolved</Badge>}
        </div>
        {selectedPeriod && (
          <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
            {selectedPeriod}
          </span>
        )}
      </div>

      {/* ── Empty states ────────────────────────────────────────── */}
      {!selectedPeriod && (
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground mb-1">No Pay Period Selected</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Choose a pay period from the Period filter above to review and resolve unresolved entries.
              </p>
            </div>
            {unresolvedCount > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span><strong>{unresolvedCount}</strong> entries still need attention across all periods.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {selectedPeriod && loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading entries…</div>
      )}
      {selectedPeriod && !loading && allRows.length === 0 && (
        <Card className="border-green-300 bg-green-50 flex-1">
          <CardContent className="pt-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-green-800 font-semibold text-base">All clear for {selectedPeriod}!</p>
            <p className="text-green-700 text-sm mt-1">No unresolved entries.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      {selectedPeriod && !loading && allRows.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">

          {/* Tabs + search */}
          <div className="flex items-center gap-3 flex-wrap shrink-0">
            <div className="flex rounded-lg border overflow-hidden shadow-sm">
              {(['RED', 'YELLOW'] as const).map(tab => {
                const count = tab === 'RED' ? redRows.length : yellowRows.length;
                const isActive = activeTab === tab;
                const cls = tab === 'RED'
                  ? isActive ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-50'
                  : isActive ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 hover:bg-amber-50';
                return (
                  <button key={tab} onClick={() => { setActiveTab(tab); setSearch(''); setSortKey(null); setSortDir(null); }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-r last:border-r-0 transition-colors ${cls}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${tab === 'RED' ? 'bg-red-400' : 'bg-amber-300'}`} />
                    {tab}
                    <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${isActive ? 'bg-white/20' : tab === 'RED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative flex-1 max-w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input className="w-full border rounded-md pl-8 pr-8 py-2 text-sm bg-white"
                placeholder="Filter by name or date…" value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {tabRows.length} rows</span>
          </div>

          {/* ── Sticky commit bar ──────────────────────────────── */}
          <div className={`shrink-0 transition-all duration-200 ${someSelected ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
            <div className="flex items-center gap-3 bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-md">
              <GitCommit className="w-4 h-4 shrink-0" />
              <span className="text-sm font-semibold">{selectedCount} row{selectedCount !== 1 ? 's' : ''} selected</span>
              <span className="text-blue-300 text-xs">— changing a <span className="text-blue-200 font-medium">highlighted</span> dropdown applies to all selected · shift-click to range-select</span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setSelected(new Set())}
                  className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors px-2 py-1 rounded hover:bg-blue-600">
                  <X className="w-3.5 h-3.5" />Deselect all
                </button>
                <Button size="sm"
                  className="bg-white text-blue-700 hover:bg-blue-50 font-semibold h-8"
                  disabled={bulkSaving}
                  onClick={handleBulkCommit}>
                  {bulkSaving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Committing…</>
                    : <><Send className="w-3.5 h-3.5 mr-1.5" />Commit {selectedCount} to GREEN</>}
                </Button>
              </div>
            </div>
          </div>

          {/* ── Work table ─────────────────────────────────────── */}
          <div className="flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 1120 }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  {/* Checkbox select-all */}
                  <th className="px-2 py-2.5 w-8 border-r sticky left-0 bg-slate-100 z-30">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center w-full">
                      {allFilteredSelected
                        ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        : someSelected
                          ? <span className="w-3.5 h-3.5 rounded-sm border-2 border-blue-400 bg-blue-100 block" />
                          : <Square className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </th>
                  <Th col="employee_name" label="Employee" className="sticky left-8 bg-slate-100 z-30 min-w-36" />
                  <Th col="work_date" label="Date" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r bg-blue-50 text-blue-700"><Edit2 className="w-3 h-3 inline mr-1" />Entry</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r bg-blue-50 text-blue-700"><Edit2 className="w-3 h-3 inline mr-1" />Exit</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r text-slate-500">Sched</th>
                  <Th col="late_minutes" label="Late m" />
                  <Th col="early_leave_minutes" label="Early m" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Event 1</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Impact 1</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Event 2</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Impact 2</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Doc</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Notes</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Auto-Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="px-4 py-8 text-center text-muted-foreground text-sm">No results match your filter.</td></tr>
                )}
                {filtered.map((row, rowIndex) => {
                  const edit = getEdit(row);
                  const dirty = isDirty(row);
                  const isSelected = selected.has(row.id);
                  const rowBg = isSelected
                    ? 'bg-blue-50'
                    : dirty
                      ? row.initial_status === 'RED' ? 'bg-red-50' : 'bg-amber-50/70'
                      : row.initial_status === 'RED' ? 'bg-[#FFF0F0]' : 'bg-[#FFFBEB]';

                  return (
                    <tr key={row.id} className={`${rowBg} border-b hover:brightness-[0.97] transition-colors ${isSelected ? 'ring-1 ring-inset ring-blue-300' : ''}`}>
                      {/* Checkbox */}
                      <td className={`px-2 py-2 w-8 border-r sticky left-0 z-10 ${rowBg}`}>
                        <button onClick={e => toggleRow(row.id, rowIndex, e.shiftKey)} className="flex items-center justify-center w-full">
                          {isSelected
                            ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            : <Square className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />}
                        </button>
                      </td>
                      {/* Frozen employee */}
                      <td className={`px-3 py-2 font-medium whitespace-nowrap border-r sticky left-8 z-10 ${rowBg}`}>
                        <span onClick={e => toggleRow(row.id, rowIndex, e.shiftKey)} className="cursor-pointer hover:text-blue-700 transition-colors">{row.employee_name}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap border-r font-mono text-slate-700">{row.work_date.slice(0, 10)}</td>
                      {/* Entry/Exit */}
                      <td className="px-2 py-1.5 border-r min-w-28 bg-blue-50/40">
                        <TimeInput className="w-full border rounded px-1.5 py-1 text-xs bg-white font-mono"
                          value={edit.entry_time} placeholder="e.g. 9:00 AM"
                          onChange={v => setEditField(row.id, 'entry_time', v, row)} />
                      </td>
                      <td className="px-2 py-1.5 border-r min-w-28 bg-blue-50/40">
                        <TimeInput className="w-full border rounded px-1.5 py-1 text-xs bg-white font-mono"
                          value={edit.exit_time} placeholder="e.g. 5:00 PM"
                          onChange={v => setEditField(row.id, 'exit_time', v, row)} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap border-r text-slate-500 text-[11px]">{row.scheduled_start}–{row.scheduled_end}</td>
                      <td className="px-3 py-2 text-center border-r">
                        {row.late_minutes > 0 ? <span className="text-red-700 font-semibold">{row.late_minutes}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center border-r">
                        {row.early_leave_minutes > 0 ? <span className="text-orange-600 font-semibold">{row.early_leave_minutes}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      {/* Event 1 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <BroadcastSelect value={edit.event_type_1} broadcasting={isSelected && selected.size > 1}
                          onChange={v => setEditField(row.id, 'event_type_1', v, row, filtered)}
                          placeholder="— none —" options={eventOpts} />
                      </td>
                      {/* Impact 1 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <BroadcastSelect value={edit.pay_impact_1} broadcasting={isSelected && selected.size > 1}
                          onChange={v => setEditField(row.id, 'pay_impact_1', v, row, filtered)}
                          placeholder="— pick —" options={impactOptions} />
                      </td>
                      {/* Event 2 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <BroadcastSelect value={edit.event_type_2} broadcasting={isSelected && selected.size > 1}
                          onChange={v => setEditField(row.id, 'event_type_2', v, row, filtered)}
                          placeholder="— none —" options={eventOpts} />
                      </td>
                      {/* Impact 2 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <BroadcastSelect value={edit.pay_impact_2} broadcasting={isSelected && selected.size > 1}
                          onChange={v => setEditField(row.id, 'pay_impact_2', v, row, filtered)}
                          placeholder="— pick —" options={impactOptions} />
                      </td>
                      {/* Doc */}
                      <td className="px-2 py-1.5 border-r min-w-28">
                        <BroadcastSelect value={edit.documentation} broadcasting={isSelected && selected.size > 1}
                          onChange={v => setEditField(row.id, 'documentation', v, row, filtered)}
                          placeholder="—" options={docOpts} />
                      </td>
                      {/* Notes */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <input className="w-full border rounded px-1.5 py-1 text-xs bg-white" value={edit.notes}
                          placeholder="add note…" onChange={e => setEditField(row.id, 'notes', e.target.value, row)} />
                      </td>
                      {/* Auto-notes */}
                      <td className="px-3 py-2 text-slate-500 max-w-52 text-[11px]">
                        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Committed section ──────────────────────────────────── */}
      {selectedPeriod && !loading && (
        <div className="shrink-0 border rounded-xl overflow-hidden shadow-sm">
          {/* Section header */}
          <button
            onClick={() => setCommittedOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 border-b border-green-200 hover:bg-green-100 transition-colors text-left"
          >
            <GitCommit className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-sm font-semibold text-green-800">Committed → On the way to GREEN</span>
            <Badge className="bg-green-600 text-white text-xs ml-1">{committed.length}</Badge>
            {sessionCommitted.size > 0 && (
              <span className="text-xs text-green-600 font-medium ml-1">({sessionCommitted.size} this session)</span>
            )}
            <ChevronRight className={`w-4 h-4 text-green-500 ml-auto transition-transform ${committedOpen ? 'rotate-90' : ''}`} />
          </button>

          {committedOpen && (
            committed.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground bg-white">
                <GitCommit className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                No committed entries yet — select rows above, fill in the event/pay impact fields, and click <strong>Commit to GREEN</strong>.
              </div>
            ) : (
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
                  <thead className="sticky top-0 bg-green-50 border-b border-green-200 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Employee</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Was</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Event 1</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Pay Impact 1</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Event 2</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Pay Impact 2</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Doc</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Notes</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700">Updated</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-green-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {committed.map(r => {
                      const isNew = sessionCommitted.has(r.id);
                      return (
                        <tr key={r.id} className={`border-b last:border-b-0 transition-colors ${isNew ? 'bg-green-50' : 'bg-white hover:bg-slate-50'}`}>
                          <td className="px-3 py-2 border-r font-medium">
                            {isNew && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />}
                            {r.employee_name}
                          </td>
                          <td className="px-3 py-2 border-r font-mono text-slate-600">{r.work_date?.slice(0, 10)}</td>
                          <td className="px-3 py-2 border-r">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_CHIP[r.initial_status] || ''}`}>{r.initial_status}</span>
                          </td>
                          <td className="px-3 py-2 border-r text-slate-700">{r.event_type_1 || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 border-r">
                            {r.pay_impact_1
                              ? <span className="text-blue-700 font-medium">{r.pay_impact_1}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 border-r text-slate-700">{r.event_type_2 || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 border-r">
                            {r.pay_impact_2
                              ? <span className="text-blue-700 font-medium">{r.pay_impact_2}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2 border-r text-slate-600">{r.documentation || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 border-r text-slate-500 max-w-40 truncate">{r.notes || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2 text-slate-400 text-[11px] font-mono whitespace-nowrap">{r.updated_at?.slice(0, 16).replace('T', ' ')}</td>
                          <td className="px-3 py-2 text-center">
                            <button
                              title={`Revert to ${r.initial_status}`}
                              disabled={revertingIds.has(r.id)}
                              onClick={() => handleRevert(r)}
                              className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                            >
                              {revertingIds.has(r.id)
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <RotateCcw className="w-3.5 h-3.5" />}
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
      )}
    </div>
  );
}
