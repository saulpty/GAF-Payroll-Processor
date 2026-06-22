import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useSearchParams } from 'react-router-dom';
import {
  TableIcon, Download, Loader2, ChevronUp, ChevronDown,
  ChevronsUpDown, Search, X, CheckCircle, Edit2, SquareCheck, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TimeInput } from '@/app/components/TimeInput';
import loadPayrollMasterAction from '@/actions/loadPayrollMaster';
import countPayrollMasterAction from '@/actions/countPayrollMaster';
import loadPeriodsAction from '@/actions/loadPeriods';
import loadPayImpactsAction from '@/actions/loadPayImpacts';
import loadDocumentationOptionsAction from '@/actions/loadDocumentationOptions';
import loadEventTypesAction from '@/actions/loadEventTypes';
import loadEventTypeRulesAction from '@/actions/loadEventTypeRules';
import updatePayrollEntryAction from '@/actions/updatePayrollEntry';
import updateEntryExitAction from '@/actions/updateEntryExit';
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

type EditState = {
  entry_time: string; exit_time: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string;
};

type SortDir = 'asc' | 'desc' | null;
type SortKey = keyof EntryRow | null;
type ActiveTab = 'ALL' | 'GREEN' | 'YELLOW' | 'RED';

type BulkEdit = {
  event_type_1?: string; pay_impact_1?: string;
  event_type_2?: string; pay_impact_2?: string;
  notes?: string;
};

type UndoSnapshot = {
  ids: number[];
  before: Record<number, { event_type_1: string; pay_impact_1: string; event_type_2: string; pay_impact_2: string; notes: string; discount_total_minutes: number; payroll_ready: string; status_current: string }>;
};

const PAGE_SIZE = 500;

const STATUS_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  GREEN:  { bg: 'bg-[#EDF7EE]', text: 'text-green-800',  badge: 'bg-green-100 text-green-700 border-green-300' },
  YELLOW: { bg: 'bg-[#FFFBEB]', text: 'text-amber-800',  badge: 'bg-amber-100 text-amber-700 border-amber-300' },
  RED:    { bg: 'bg-[#FFF0F0]', text: 'text-red-800',    badge: 'bg-red-100 text-red-700 border-red-300' },
};

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-blue-600" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-blue-600" />;
}

export default function PayrollMaster() {
  const [searchParams] = useSearchParams();
  const [periods] = useLoadAction(loadPeriodsAction, [] as { period_name: string }[]);
  const [payImpacts] = useLoadAction(loadPayImpactsAction, [] as { name: string }[]);
  const [docOptions] = useLoadAction(loadDocumentationOptionsAction, [] as { name: string }[]);
  const [eventTypes] = useLoadAction(loadEventTypesAction, [] as { name: string }[]);
  const [eventRulesRaw] = useLoadAction(loadEventTypeRulesAction, [] as { event_type: string; default_pay_impact: string }[]);
  const [updateEntry, saving] = useMutateAction(updatePayrollEntryAction);
  const [updateTimes] = useMutateAction(updateEntryExitAction);

  const [filterPeriod, setFilterPeriod] = useState(searchParams.get('period') || '');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [filterImpact, setFilterImpact] = useState('');
  const [hideOnTime, setHideOnTime] = useState(false);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const [edits, setEdits] = useState<Record<number, EditState>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [toastMsg, setToastMsg] = useState('');

  // ── Multi-select + bulk edit ──────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEdit, setBulkEdit] = useState<BulkEdit>({});
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  const [params, setParams] = useState({
    periodName: searchParams.get('period') || '',
    employeeName: '',
    status: '',
    offset: 0,
  });

  useEffect(() => {
    const p = searchParams.get('period');
    if (p) { setFilterPeriod(p); setParams(prev => ({ ...prev, periodName: p })); }
  }, [searchParams]);

  const [rows, loading, , reload] = useLoadAction(loadPayrollMasterAction, [] as EntryRow[], params);
  const [countData] = useLoadAction(countPayrollMasterAction, [] as { total: number }[], {
    periodName: params.periodName, employeeName: params.employeeName, status: params.status,
  });

  const total = (countData as { total: number }[])[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const impactOptions = (payImpacts as { name: string }[]).map(p => p.name);
  const docOpts = (docOptions as { name: string }[]).map(d => d.name);
  const eventOpts = (eventTypes as { name: string }[]).map(e => e.name);
  const rulesMap = useMemo(() => {
    const m = new Map<string, { pay_impact: string; doc_option: string }>();
    for (const r of eventRulesRaw as { event_type: string; default_pay_impact: string; default_doc_option: string }[]) {
      m.set(r.event_type, { pay_impact: r.default_pay_impact || '', doc_option: r.default_doc_option || '' });
    }
    return m;
  }, [eventRulesRaw]);

  const applyFilters = useCallback(() => {
    setPage(0);
    setParams({ periodName: filterPeriod, employeeName: filterEmployee, status: '', offset: 0 });
    setEdits({}); setSavedIds(new Set());
  }, [filterPeriod, filterEmployee]);

  // "On time full shift" = GREEN status with no events, no late/early minutes
  const isOnTimeFullShift = (r: EntryRow) =>
    r.status_current === 'GREEN' &&
    !r.event_type_1 && !r.event_type_2 &&
    r.late_minutes === 0 && r.early_leave_minutes === 0 &&
    r.discount_total_minutes === 0;

  const goPage = (p: number) => {
    setPage(p);
    setParams(prev => ({ ...prev, offset: p * PAGE_SIZE }));
  };

  const getEdit = (row: EntryRow): EditState =>
    edits[row.id] ?? {
      entry_time: row.entry_time || '',
      exit_time: row.exit_time || '',
      event_type_1: row.event_type_1 || '',
      pay_impact_1: row.pay_impact_1 || '',
      event_type_2: row.event_type_2 || '',
      pay_impact_2: row.pay_impact_2 || '',
      documentation: row.documentation || '',
      notes: row.notes || '',
    };

  const setEditField = (id: number, field: keyof EditState, value: string, row: EntryRow) => {
    const current = { ...getEdit(row), ...edits[id] };
    const updated = { ...current, [field]: value };
    // Auto-fill pay impact from rules when event type changes
    if (field === 'event_type_1' && value && rulesMap.has(value)) {
      const rule = rulesMap.get(value)!;
      if (!current.pay_impact_1 && rule.pay_impact) updated.pay_impact_1 = rule.pay_impact;
      if (!current.documentation && rule.doc_option) updated.documentation = rule.doc_option;
    }
    if (field === 'event_type_2' && value && rulesMap.has(value)) {
      const rule = rulesMap.get(value)!;
      if (!current.pay_impact_2 && rule.pay_impact) updated.pay_impact_2 = rule.pay_impact;
    }
    setEdits(prev => ({ ...prev, [id]: updated }));
    setSavedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const isDirty = (row: EntryRow) => !!edits[row.id];

  const handleSave = async (row: EntryRow) => {
    const edit = getEdit(row);
    // Save entry/exit times separately if changed
    const timesChanged = edit.entry_time !== (row.entry_time || '') || edit.exit_time !== (row.exit_time || '');
    const fieldsDirty = isDirty(row) && (
      edit.event_type_1 !== (row.event_type_1 || '') ||
      edit.pay_impact_1 !== (row.pay_impact_1 || '') ||
      edit.event_type_2 !== (row.event_type_2 || '') ||
      edit.pay_impact_2 !== (row.pay_impact_2 || '') ||
      edit.documentation !== (row.documentation || '') ||
      edit.notes !== (row.notes || '') || timesChanged
    );
    if (!fieldsDirty) return;

    const derived = computeDerivedFields({
      event_type_1: edit.event_type_1,
      pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2,
      pay_impact_2: edit.pay_impact_2,
      late_minutes: row.late_minutes,
      late_after_grace: row.late_after_grace,
      early_leave_minutes: row.early_leave_minutes,
      initial_status: row.initial_status,
    });

    setSavingId(row.id);
    if (timesChanged) {
      await updateTimes({ id: row.id, entry_time: edit.entry_time || null, exit_time: edit.exit_time || null });
    }
    await updateEntry({
      id: row.id,
      event_type_1: edit.event_type_1,
      pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2,
      pay_impact_2: edit.pay_impact_2,
      documentation: edit.documentation,
      notes: edit.notes,
      discount_total_minutes: derived.discount_total_minutes,
      payroll_ready: derived.payroll_ready,
      status_current: derived.status_current,
    });
    setSavingId(null);
    setSavedIds(prev => new Set(prev).add(row.id));
    if (derived.payroll_ready === 'YES') {
      setToastMsg(`✓ ${row.employee_name} — ${row.work_date} resolved to GREEN`);
      setTimeout(() => setToastMsg(''), 3000);
    }
    await reload();
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const toggleSelectAll = useCallback((ids: number[]) => {
    setSelectedIds(prev => {
      if (ids.every(id => prev.has(id))) return new Set();
      return new Set(ids);
    });
  }, []);

  const handleBulkSave = async () => {
    const targetRows = filtered.filter(r => selectedIds.has(r.id));
    if (targetRows.length === 0) return;
    // Build undo snapshot
    const before: UndoSnapshot['before'] = {};
    for (const r of targetRows) {
      before[r.id] = {
        event_type_1: r.event_type_1, pay_impact_1: r.pay_impact_1,
        event_type_2: r.event_type_2, pay_impact_2: r.pay_impact_2,
        notes: r.notes, discount_total_minutes: r.discount_total_minutes,
        payroll_ready: r.payroll_ready, status_current: r.status_current,
      };
    }
    setUndoSnapshot({ ids: targetRows.map(r => r.id), before });
    setBulkSaving(true);
    setShowBulkConfirm(false);
    try {
      for (const r of targetRows) {
        const merged = {
          event_type_1: bulkEdit.event_type_1 !== undefined ? bulkEdit.event_type_1 : (r.event_type_1 || ''),
          pay_impact_1: bulkEdit.pay_impact_1 !== undefined ? bulkEdit.pay_impact_1 : (r.pay_impact_1 || ''),
          event_type_2: bulkEdit.event_type_2 !== undefined ? bulkEdit.event_type_2 : (r.event_type_2 || ''),
          pay_impact_2: bulkEdit.pay_impact_2 !== undefined ? bulkEdit.pay_impact_2 : (r.pay_impact_2 || ''),
          notes: bulkEdit.notes !== undefined ? bulkEdit.notes : (r.notes || ''),
          late_minutes: r.late_minutes, late_after_grace: r.late_after_grace,
          early_leave_minutes: r.early_leave_minutes, initial_status: r.initial_status,
        };
        const derived = computeDerivedFields(merged);
        await updateEntry({
          id: r.id,
          event_type_1: merged.event_type_1, pay_impact_1: merged.pay_impact_1,
          event_type_2: merged.event_type_2, pay_impact_2: merged.pay_impact_2,
          documentation: r.documentation, notes: merged.notes,
          discount_total_minutes: derived.discount_total_minutes,
          payroll_ready: derived.payroll_ready, status_current: derived.status_current,
        });
      }
      setSelectedIds(new Set());
      setBulkEdit({});
      setToastMsg(`✓ Bulk saved ${targetRows.length} rows`);
      setTimeout(() => setToastMsg(''), 3500);
      await reload();
    } finally { setBulkSaving(false); }
  };

  const handleUndo = async () => {
    if (!undoSnapshot) return;
    setBulkSaving(true);
    try {
      for (const id of undoSnapshot.ids) {
        const snap = undoSnapshot.before[id];
        await updateEntry({
          id, event_type_1: snap.event_type_1, pay_impact_1: snap.pay_impact_1,
          event_type_2: snap.event_type_2, pay_impact_2: snap.pay_impact_2,
          documentation: '', notes: snap.notes,
          discount_total_minutes: snap.discount_total_minutes,
          payroll_ready: snap.payroll_ready, status_current: snap.status_current,
        });
      }
      setUndoSnapshot(null);
      setToastMsg('↩ Bulk edit undone');
      setTimeout(() => setToastMsg(''), 3000);
      await reload();
    } finally { setBulkSaving(false); }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      const next = sortDir === 'asc' ? 'desc' : null;
      setSortDir(next);
      if (!next) setSortKey(null);
    } else {
      setSortKey(key); setSortDir('asc');
    }
  };

  const allRows = rows as EntryRow[];

  // Tab counts
  const tabCounts = useMemo(() => ({
    ALL: allRows.length,
    GREEN: allRows.filter(r => r.status_current === 'GREEN').length,
    YELLOW: allRows.filter(r => r.status_current === 'YELLOW').length,
    RED: allRows.filter(r => r.status_current === 'RED').length,
  }), [allRows]);

  const filtered = useMemo(() => {
    let out = activeTab === 'ALL' ? allRows : allRows.filter(r => r.status_current === activeTab);
    if (hideOnTime) out = out.filter(r => !isOnTimeFullShift(r));
    if (filterEvent.trim()) {
      const q = filterEvent.toLowerCase();
      out = out.filter(r =>
        (r.event_type_1 || '').toLowerCase().includes(q) ||
        (r.event_type_2 || '').toLowerCase().includes(q)
      );
    }
    if (filterImpact.trim()) {
      const q = filterImpact.toLowerCase();
      out = out.filter(r =>
        (r.pay_impact_1 || '').toLowerCase().includes(q) ||
        (r.pay_impact_2 || '').toLowerCase().includes(q)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r => r.employee_name.toLowerCase().includes(q) || r.work_date.includes(q));
    }
    if (sortKey && sortDir) {
      out = [...out].sort((a, b) => {
        const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [allRows, activeTab, hideOnTime, filterEvent, filterImpact, search, sortKey, sortDir]);

  const exportCsv = () => {
    const headers = ['Period','Employee','Date','Entry','Exit','Sched','Late','Early','Discount','Event1','Impact1','Event2','Impact2','Doc','Notes','Status','Auto-Notes'];
    const lines = filtered.map(r => [
      r.period_name, r.employee_name, r.work_date,
      r.entry_time||'', r.exit_time||'',
      `${r.scheduled_start}-${r.scheduled_end}`,
      r.late_minutes, r.early_leave_minutes, r.discount_total_minutes,
      r.event_type_1, r.pay_impact_1, r.event_type_2, r.pay_impact_2,
      r.documentation, `"${(r.notes||'').replace(/"/g,'""')}"`,
      r.status_current, `"${(r.auto_notes||'').replace(/"/g,'""')}"`
    ].join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planilla_${params.periodName || 'all'}.csv`;
    a.click();
  };

  const TAB_STYLES: Record<ActiveTab, { active: string; idle: string; dot: string }> = {
    ALL:    { active: 'bg-slate-700 text-white border-slate-700', idle: 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50', dot: 'bg-slate-400' },
    GREEN:  { active: 'bg-green-600 text-white border-green-600', idle: 'bg-white text-green-700 border-green-300 hover:bg-green-50', dot: 'bg-green-400' },
    YELLOW: { active: 'bg-amber-500 text-white border-amber-500', idle: 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50', dot: 'bg-amber-300' },
    RED:    { active: 'bg-red-600 text-white border-red-600',     idle: 'bg-white text-red-700 border-red-300 hover:bg-red-50',     dot: 'bg-red-400' },
  };

  const Th = ({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r last:border-r-0 cursor-pointer select-none hover:bg-slate-200 transition-colors ${className}`}
      onClick={() => col && handleSort(col)}
    >
      {label}{col && <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />}
    </th>
  );

  return (
    <div className="flex flex-col h-full p-6 gap-4 overflow-hidden">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4" />{toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <TableIcon className="w-6 h-6 text-green-600" />
          <h1 className="text-xl font-bold">Payroll Master</h1>
          {total > 0 && <span className="text-sm text-muted-foreground">{total.toLocaleString()} rows</span>}
        </div>
        <div className="flex items-center gap-2">
          {undoSnapshot && (
            <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50"
              disabled={bulkSaving} onClick={handleUndo}>
              <Undo2 className="w-3.5 h-3.5 mr-1.5" />Undo Bulk
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex gap-2 shrink-0 flex-wrap items-center">
        <select className="border rounded-md px-3 py-2 text-sm min-w-44 bg-white"
          value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
          <option value="">All Periods</option>
          {(periods as { period_name: string }[]).map(p => (
            <option key={p.period_name} value={p.period_name}>{p.period_name}</option>
          ))}
        </select>
        <input className="border rounded-md px-3 py-2 text-sm w-44 bg-white"
          placeholder="Employee…"
          value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyFilters()} />
        <Button size="sm" onClick={applyFilters}>Apply</Button>
        <Button size="sm" variant="outline" onClick={() => {
          setFilterPeriod(''); setFilterEmployee('');
          setParams({ periodName: '', employeeName: '', status: '', offset: 0 });
          setPage(0); setEdits({}); setSavedIds(new Set());
        }}>Clear</Button>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* Event filter */}
        <select className="border rounded-md px-3 py-2 text-sm min-w-40 bg-white"
          value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
          <option value="">All Events</option>
          {eventOpts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Pay Impact filter */}
        <select className="border rounded-md px-3 py-2 text-sm min-w-40 bg-white"
          value={filterImpact} onChange={e => setFilterImpact(e.target.value)}>
          <option value="">All Pay Impacts</option>
          {impactOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Hide on-time toggle */}
        <button
          onClick={() => setHideOnTime(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
            hideOnTime
              ? 'bg-green-700 text-white border-green-700'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${hideOnTime ? 'bg-white' : 'bg-green-400'}`} />
          {hideOnTime ? 'Showing exceptions only' : 'Hide On-Time Full Shifts'}
        </button>

        {(filterEvent || filterImpact || hideOnTime) && (
          <button onClick={() => { setFilterEvent(''); setFilterImpact(''); setHideOnTime(false); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <X className="w-3 h-3" />Clear filters
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />Loading…
        </div>
      )}

      {!loading && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          {/* Status tabs + inline search */}
          <div className="flex items-center gap-3 flex-wrap shrink-0">
            <div className="flex rounded-lg border overflow-hidden shadow-sm">
              {(['ALL','GREEN','YELLOW','RED'] as ActiveTab[]).map(tab => {
                const s = TAB_STYLES[tab];
                const count = tabCounts[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSearch(''); setSortKey(null); setSortDir(null); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-r last:border-r-0 transition-colors ${activeTab === tab ? s.active : s.idle}`}
                  >
                    {tab !== 'ALL' && <span className={`w-2 h-2 rounded-full ${s.dot} ${activeTab === tab ? 'opacity-100' : 'opacity-60'}`} />}
                    {tab}
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${activeTab === tab ? 'bg-white/20' : tab === 'GREEN' ? 'bg-green-100 text-green-700' : tab === 'YELLOW' ? 'bg-amber-100 text-amber-700' : tab === 'RED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative max-w-64 flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input className="w-full border rounded-md pl-8 pr-8 py-2 text-sm bg-white"
                placeholder="Filter by name or date…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {tabCounts[activeTab]} rows</span>
          </div>

          {/* Bulk edit toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 flex-wrap shrink-0 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <span className="text-sm font-semibold text-blue-700">
                <SquareCheck className="w-4 h-4 inline mr-1" />{selectedIds.size} rows selected
              </span>
              <div className="w-px h-5 bg-blue-200" />
              <select className="border rounded px-2 py-1 text-xs bg-white" value={bulkEdit.event_type_1 ?? ''}
                onChange={e => setBulkEdit(p => ({ ...p, event_type_1: e.target.value }))}>
                <option value="">Event 1 (unchanged)</option>
                {eventOpts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="border rounded px-2 py-1 text-xs bg-white" value={bulkEdit.pay_impact_1 ?? ''}
                onChange={e => setBulkEdit(p => ({ ...p, pay_impact_1: e.target.value }))}>
                <option value="">Impact 1 (unchanged)</option>
                {impactOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="border rounded px-2 py-1 text-xs bg-white" value={bulkEdit.event_type_2 ?? ''}
                onChange={e => setBulkEdit(p => ({ ...p, event_type_2: e.target.value }))}>
                <option value="">Event 2 (unchanged)</option>
                {eventOpts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="border rounded px-2 py-1 text-xs bg-white" value={bulkEdit.pay_impact_2 ?? ''}
                onChange={e => setBulkEdit(p => ({ ...p, pay_impact_2: e.target.value }))}>
                <option value="">Impact 2 (unchanged)</option>
                {impactOptions.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className="border rounded px-2 py-1 text-xs bg-white w-36" placeholder="Notes (unchanged)"
                value={bulkEdit.notes ?? ''}
                onChange={e => setBulkEdit(p => ({ ...p, notes: e.target.value }))} />
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={Object.keys(bulkEdit).length === 0 || bulkSaving}
                onClick={() => setShowBulkConfirm(true)}>
                {bulkSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Apply to {selectedIds.size} rows
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setSelectedIds(new Set()); setBulkEdit({}); }}>
                <X className="w-3 h-3 mr-1" />Clear
              </Button>
              {undoSnapshot && (
                <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  disabled={bulkSaving} onClick={handleUndo}>
                  <Undo2 className="w-3 h-3 mr-1" />Undo last bulk
                </Button>
              )}
            </div>
          )}

          {/* Bulk confirm modal */}
          {showBulkConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-xl border border-border p-6 max-w-lg w-full mx-4">
                <h3 className="font-bold text-lg mb-1">Confirm Bulk Edit</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You are about to apply changes to <strong>{selectedIds.size} rows</strong>. Only filled fields will be overwritten.
                </p>
                <div className="bg-slate-50 rounded-lg border p-3 mb-4 text-sm space-y-1.5">
                  {bulkEdit.event_type_1 !== undefined && <div><span className="font-medium text-slate-600">Event 1 →</span> <span className="text-slate-900">{bulkEdit.event_type_1 || '(clear)'}</span></div>}
                  {bulkEdit.pay_impact_1 !== undefined && <div><span className="font-medium text-slate-600">Impact 1 →</span> <span className="text-slate-900">{bulkEdit.pay_impact_1 || '(clear)'}</span></div>}
                  {bulkEdit.event_type_2 !== undefined && <div><span className="font-medium text-slate-600">Event 2 →</span> <span className="text-slate-900">{bulkEdit.event_type_2 || '(clear)'}</span></div>}
                  {bulkEdit.pay_impact_2 !== undefined && <div><span className="font-medium text-slate-600">Impact 2 →</span> <span className="text-slate-900">{bulkEdit.pay_impact_2 || '(clear)'}</span></div>}
                  {bulkEdit.notes !== undefined && <div><span className="font-medium text-slate-600">Notes →</span> <span className="text-slate-900">"{bulkEdit.notes}"</span></div>}
                </div>
                <div className="bg-slate-50 rounded-lg border p-3 mb-4 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Affected rows:</p>
                  {filtered.filter(r => selectedIds.has(r.id)).map(r => (
                    <div key={r.id} className="text-xs text-slate-700 flex gap-2">
                      <span className="font-medium">{r.employee_name}</span>
                      <span className="text-slate-400">{r.work_date.slice(0,10)}</span>
                      <span className="text-slate-500">{r.event_type_1}{r.pay_impact_1 ? ` / ${r.pay_impact_1}` : ''}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mb-4">⚠ This action will overwrite existing data. An undo option will be available immediately after.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>Cancel</Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleBulkSave} disabled={bulkSaving}>
                    {bulkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Confirm & Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto">
            <table className="w-full text-xs border-collapse" style={{ minWidth: 1400 }}>
              <thead className="sticky top-0 z-20">
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="w-8 px-2 py-2.5 border-r">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={filtered.length > 0 && filtered.every(r => selectedIds.has(r.id))}
                      onChange={() => toggleSelectAll(filtered.map(r => r.id))}
                      title="Select all visible rows"
                    />
                  </th>
                  <Th col="employee_name" label="Employee" className="sticky left-0 bg-slate-100 z-30 min-w-36" />
                  <Th col="work_date" label="Date" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r bg-blue-50 text-blue-700">
                    <Edit2 className="w-3 h-3 inline mr-1" />Entry
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r bg-blue-50 text-blue-700">
                    <Edit2 className="w-3 h-3 inline mr-1" />Exit
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r text-slate-500">Sched</th>
                  <Th col="late_minutes" label="Late m" />
                  <Th col="early_leave_minutes" label="Early m" />
                  <Th col="discount_total_minutes" label="Disc m" />
                  <Th col="event_type_1" label="Event 1" />
                  <Th col="pay_impact_1" label="Impact 1" />
                  <Th col="event_type_2" label="Event 2" />
                  <Th col="pay_impact_2" label="Impact 2" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Doc</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r">Notes</th>
                  <Th col="status_current" label="Status" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r text-slate-500">Auto-Notes</th>
                  <th className="w-16 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={17} className="px-4 py-8 text-center text-muted-foreground text-sm">No records match the current filters.</td></tr>
                )}
                {filtered.map(row => {
                  const edit = getEdit(row);
                  const isSavingRow = savingId === row.id;
                  const dirty = isDirty(row);
                  const saved = savedIds.has(row.id);
                  const sc = STATUS_COLORS[row.status_current] || { bg: '', text: '', badge: '' };
                  const rowBg = dirty ? (row.status_current === 'RED' ? 'bg-[#FFE4E4]' : row.status_current === 'YELLOW' ? 'bg-[#FFF3CD]' : 'bg-blue-50') : sc.bg;

                  return (
                    <tr key={row.id} className={`${rowBg} border-b hover:brightness-[0.97] transition-colors ${selectedIds.has(row.id) ? 'ring-1 ring-inset ring-blue-400' : ''}`}>
                      <td className="w-8 px-2 py-2 border-r text-center">
                        <input type="checkbox" className="rounded" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} />
                      </td>
                      <td className={`px-3 py-2 font-medium whitespace-nowrap border-r sticky left-0 z-10 ${rowBg}`}>{row.employee_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap border-r font-mono text-slate-700">{row.work_date.slice(0,10)}</td>

                      {/* Editable: Entry Time */}
                      <td className="px-2 py-1.5 border-r min-w-28 bg-blue-50/50">
                        <TimeInput
                          className="w-full border rounded px-1.5 py-1 text-xs bg-white font-mono"
                          value={edit.entry_time}
                          onChange={v => setEditField(row.id, 'entry_time', v, row)}
                          placeholder="e.g. 9:00 AM"
                        />
                      </td>
                      {/* Editable: Exit Time */}
                      <td className="px-2 py-1.5 border-r min-w-28 bg-blue-50/50">
                        <TimeInput
                          className="w-full border rounded px-1.5 py-1 text-xs bg-white font-mono"
                          value={edit.exit_time}
                          onChange={v => setEditField(row.id, 'exit_time', v, row)}
                          placeholder="e.g. 5:00 PM"
                        />
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap border-r text-slate-500 text-[11px]">{row.scheduled_start}–{row.scheduled_end}</td>
                      <td className="px-3 py-2 text-center border-r">{row.late_minutes > 0 ? <span className="text-red-700 font-semibold">{row.late_minutes}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-center border-r">{row.early_leave_minutes > 0 ? <span className="text-orange-600 font-semibold">{row.early_leave_minutes}</span> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-center border-r font-semibold">{row.discount_total_minutes > 0 ? row.discount_total_minutes : <span className="text-slate-300">—</span>}</td>

                      {/* Editable: Event Type 1 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <select className="w-full border rounded px-1.5 py-1 text-xs bg-white"
                          value={edit.event_type_1}
                          onChange={e => setEditField(row.id, 'event_type_1', e.target.value, row)}>
                          <option value="">— none —</option>
                          {eventOpts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      {/* Editable: Pay Impact 1 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <select className="w-full border rounded px-1.5 py-1 text-xs bg-white"
                          value={edit.pay_impact_1}
                          onChange={e => setEditField(row.id, 'pay_impact_1', e.target.value, row)}>
                          <option value="">— pick —</option>
                          {impactOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      {/* Editable: Event Type 2 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <select className="w-full border rounded px-1.5 py-1 text-xs bg-white"
                          value={edit.event_type_2}
                          onChange={e => setEditField(row.id, 'event_type_2', e.target.value, row)}>
                          <option value="">— none —</option>
                          {eventOpts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      {/* Editable: Pay Impact 2 */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <select className="w-full border rounded px-1.5 py-1 text-xs bg-white"
                          value={edit.pay_impact_2}
                          onChange={e => setEditField(row.id, 'pay_impact_2', e.target.value, row)}>
                          <option value="">— pick —</option>
                          {impactOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      {/* Editable: Documentation */}
                      <td className="px-2 py-1.5 border-r min-w-28">
                        <select className="w-full border rounded px-1.5 py-1 text-xs bg-white"
                          value={edit.documentation}
                          onChange={e => setEditField(row.id, 'documentation', e.target.value, row)}>
                          <option value="">—</option>
                          {docOpts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      {/* Editable: Notes */}
                      <td className="px-2 py-1.5 border-r min-w-36">
                        <input className="w-full border rounded px-1.5 py-1 text-xs bg-white"
                          value={edit.notes}
                          onChange={e => setEditField(row.id, 'notes', e.target.value, row)}
                          placeholder="notes…" />
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-2 border-r">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.badge}`}>
                          {row.status_current}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-r text-slate-500 max-w-48 text-[11px]">
                        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
                      </td>

                      {/* Save */}
                      <td className="px-2 py-1.5 text-center">
                        {saved && !dirty ? (
                          <span className="inline-flex items-center gap-1 text-green-700 text-[11px] font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />Saved
                          </span>
                        ) : (
                          <Button size="sm" variant={dirty ? 'default' : 'outline'}
                            className={`text-xs h-7 px-3 ${dirty ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                            disabled={isSavingRow || saving || !dirty}
                            onClick={() => handleSave(row)}>
                            {isSavingRow ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between shrink-0 text-sm">
              <span className="text-muted-foreground">Page {page+1} of {totalPages} ({total.toLocaleString()} total rows)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page===0} onClick={() => goPage(page-1)}>Prev</Button>
                <Button size="sm" variant="outline" disabled={page>=totalPages-1} onClick={() => goPage(page+1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
