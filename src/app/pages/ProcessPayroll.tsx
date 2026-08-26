import { useState, useRef, useMemo } from 'react';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  PlayCircle, Upload, AlertTriangle, CheckCircle, XCircle,
  Loader2, X, FileText, Calendar, Settings2,
  ChevronRight, ArrowRight, Clock, TrendingUp, Search,
} from 'lucide-react';
import loadEmployeesAction from '@/actions/loadEmployees';
import loadDstCalendarAction from '@/actions/loadDstCalendar';
import loadHolidaysAction from '@/actions/loadHolidays';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import loadPeriodsAction from '@/actions/loadPeriods';
import loadUnresolvedPerPeriodAction from '@/actions/loadUnresolvedPerPeriod';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import saveRunSnapshotAction from '@/actions/saveRunSnapshot';
import upsertPayrollEntriesAction from '@/actions/upsertPayrollEntries';
import upsertPeriodAction from '@/actions/upsertPeriod';
import saveNameAliasAction from '@/actions/saveNameAlias';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import { parseTeramindFile, processTeramindData, buildFullTeramindResolver } from '@/app/lib/teramindParser';
import {
  runClassificationEngine,
  buildClassificationConfig,
  normalizeName,
  isScheduledWorkDay,
  toLocalYMD,
  type EmployeeRecord,
  type DstWindow,
  type MondayAttendanceRow,
  type MondayAdjustmentRow,
  type MondayPermissionRow,
} from '@/app/lib/classificationEngine';

type Employee = {
  id: number; display_name: string; teramind_email: string;
  is_grace_list: boolean; is_macbook_swap: boolean;
  schedule_name: string; dst_start: string; dst_end: string;
  standard_start: string; standard_end: string; grace_minutes: number;
  work_days?: string;
};
type Period = {
  period_name: string; start_date: string; end_date: string;
  processed_at: string; employee_count: number; day_count: number;
  green_count: number; yellow_count: number; red_count: number;
};

type RunStatus = 'idle' | 'preflight' | 'running' | 'mapping' | 'warnings' | 'done' | 'error';
interface UnmappedName { name: string; source: 'teramind' | 'monday'; }
interface MappingEntry { name: string; employeeId: number | null; ignore: boolean; }
interface DataWarning { level: 'error' | 'warn'; message: string; }

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusDot({ s }: { s: 'GREEN' | 'YELLOW' | 'RED' }) {
  const cls = s === 'GREEN' ? 'bg-green-500' : s === 'YELLOW' ? 'bg-amber-400' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}

function PeriodCard({ p, unresolvedCount, onClick }: { p: Period; unresolvedCount: number; onClick: () => void }) {
  const total = (p.green_count || 0) + (p.yellow_count || 0) + (p.red_count || 0);
  const greenPct = total ? Math.round((p.green_count / total) * 100) : 0;
  return (
    <button onClick={onClick}
      className="w-full text-left border rounded-lg px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{p.period_name}</span>
        {unresolvedCount > 0
          ? <Badge variant="destructive" className="text-[10px] py-0">{unresolvedCount} open</Badge>
          : <Badge className="text-[10px] py-0 bg-green-100 text-green-700 border-green-200">All clear</Badge>}
      </div>
      <div className="flex items-center gap-1 mb-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${greenPct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground w-8 text-right">{greenPct}%</span>
      </div>
      <div className="flex gap-2 text-[11px]">
        <span className="text-green-700 font-medium">{p.green_count}✓</span>
        {p.yellow_count > 0 && <span className="text-amber-600 font-medium">{p.yellow_count}⚠</span>}
        {p.red_count > 0 && <span className="text-red-600 font-medium">{p.red_count}✗</span>}
        <span className="text-slate-400 ml-auto">{p.employee_count} emp</span>
      </div>
    </button>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function ProcessPayroll() {
  const navigate = useNavigate();
  const { bumpPeriodsVersion } = useGlobalFilters();
  const [employees] = useLoadAction(loadEmployeesAction, [] as Employee[]);
  const [dstCalendar] = useLoadAction(loadDstCalendarAction, [] as DstWindow[]);
  const [holidays] = useLoadAction(loadHolidaysAction, [] as { date: string; name: string }[]);
  const [nameAliases] = useLoadAction(loadNameAliasesAction, [] as { alias_text: string; display_name: string; employee_id: number }[]);
  const [periods, , , reloadPeriods] = useLoadAction(loadPeriodsAction, [] as Period[]);
  const [unresolvedPerPeriod, , , reloadUnresolved] = useLoadAction(loadUnresolvedPerPeriodAction, [] as { period_name: string; unresolved_count: number }[]);
  const [classificationConfigRows] = useLoadAction(loadClassificationConfigAction, [] as { key: string; value: string }[]);

  const [saveSnapshot] = useMutateAction(saveRunSnapshotAction);
  const [upsertEntry] = useMutateAction(upsertPayrollEntriesAction);
  const [upsertPer] = useMutateAction(upsertPeriodAction);
  const [saveName] = useMutateAction(saveNameAliasAction);
  const [pullBoard] = useMutateAction(pullMondayBoardAction);

  // Form state
  const [periodName, setPeriodName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [midDayPull, setMidDayPull] = useState(false);
  const [outageDates, setOutageDates] = useState<string[]>([]);
  const [outageInput, setOutageInput] = useState('');
  const [excludedIds, setExcludedIds] = useState<number[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [teramindFile, setTeramindFile] = useState<File | null>(null);
  const [teramindRows, setTeramindRows] = useState<ReturnType<typeof parseTeramindFile>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Single-employee re-run
  const [singleEmpMode, setSingleEmpMode] = useState(false);
  const [singleEmpIds, setSingleEmpIds] = useState<number[]>([]);
  const [singleEmpSearch, setSingleEmpSearch] = useState('');

  // Run state
  const [status, setStatus] = useState<RunStatus>('idle');
  const [runLog, setRunLog] = useState<{ text: string; ts: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [unmapped, setUnmapped] = useState<UnmappedName[]>([]);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [result, setResult] = useState<{ green: number; yellow: number; red: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [dataWarnings, setDataWarnings] = useState<DataWarning[]>([]);
  const [stashedMonday, setStashedMonday] = useState<{
    attendance: MondayAttendanceRow[];
    adjustments: MondayAdjustmentRow[];
    permissions: MondayPermissionRow[];
  } | null>(null);

  const log = (msg: string) => setRunLog(prev => [...prev, { text: msg, ts: new Date().toLocaleTimeString() }]);
  const isRunning = status === 'preflight' || status === 'running';
  const existingPeriods = periods as Period[];
  const existingNames = useMemo(() => new Set(existingPeriods.map(p => p.period_name)), [existingPeriods]);
  const unresolvedMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of unresolvedPerPeriod as { period_name: string; unresolved_count: number }[]) {
      m.set(r.period_name, r.unresolved_count);
    }
    return m;
  }, [unresolvedPerPeriod]);
  const isRerun = periodName.trim() !== '' && existingNames.has(periodName.trim());

  // File upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setTeramindFile(file);
    if (!file) { setTeramindRows([]); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const buffer = ev.target?.result as ArrayBuffer;
      const rows = parseTeramindFile(buffer, file.name);
      setTeramindRows(rows);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      fileRef.current && (fileRef.current.files = e.dataTransfer.files);
      handleFileChange({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const addOutageDate = () => {
    const d = outageInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !outageDates.includes(d)) {
      setOutageDates(prev => [...prev, d].sort());
    }
    setOutageInput('');
  };

  const toggleExclude = (id: number) =>
    setExcludedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const buildTeramindResolverMap = () => {
    const emps = employees as Employee[];
    const aliases = nameAliases as { alias_text: string; display_name: string; employee_id: number }[];
    return buildFullTeramindResolver(
      emps.map(e => ({ display_name: e.display_name, teramind_email: e.teramind_email })),
      aliases,
      emps.map(e => ({ id: e.id, teramind_email: e.teramind_email }))
    );
  };

  const buildNameMap = (extraMappings: MappingEntry[] = []): Map<string, number> => {
    const map = new Map<string, number>();
    for (const emp of employees as Employee[]) map.set(normalizeName(emp.display_name), emp.id);
    for (const alias of nameAliases as { alias_text: string; employee_id: number }[]) map.set(normalizeName(alias.alias_text), alias.employee_id);
    for (const m of extraMappings) if (m.employeeId) map.set(normalizeName(m.name), m.employeeId);
    return map;
  };

  const cfgRows = classificationConfigRows as { key: string; value: string }[];
  const missingCfgKeys = new Set<string>();
  const cfgGet = (k: string, fallback: string) => {
    const found = cfgRows.find(r => r.key === k);
    if (!found) missingCfgKeys.add(k);
    return found?.value ?? fallback;
  };
  const BOARD_ATTENDANCE  = parseInt(cfgGet('monday_board_attendance',  '9542698245'),  10);
  const BOARD_ADJUSTMENTS = parseInt(cfgGet('monday_board_adjustments', '18394647909'), 10);
  const BOARD_PERMISSIONS = parseInt(cfgGet('monday_board_permissions', '18394590373'), 10);

  const parseMondayItems = (attendanceItems: unknown[], adjustmentsItems: unknown[], permissionsItems: unknown[]) => {
    const attendance: MondayAttendanceRow[] = [];
    const adjustments: MondayAdjustmentRow[] = [];
    const permissions: MondayPermissionRow[] = [];
    // Column IDs from config (with hardcoded fallbacks)
    const COL_ATT_EMAIL  = cfgGet('monday_col_attendance_email',      'email_mkzjpqgt');
    const COL_ATT_DATE   = cfgGet('monday_col_attendance_date',       'date0d5ep965');
    const COL_ATT_TYPE   = cfgGet('monday_col_attendance_type',       'single_selectjxb85m6');
    const COL_ATT_REASON = cfgGet('monday_col_attendance_reason',     'color_mksnwwxd');
    const COL_ADJ_EMAIL  = cfgGet('monday_col_adjustments_email',     'email_mkzjtb9v');
    const COL_ADJ_DATE   = cfgGet('monday_col_adjustments_date',      'date_mkzk6a5a');
    const COL_ADJ_TYPE   = cfgGet('monday_col_adjustments_type',      'single_selectnisb6ij');
    const COL_PER_EMAIL  = cfgGet('monday_col_permissions_email',     'email_mkzjqdh7');
    const COL_PER_RANGE  = cfgGet('monday_col_permissions_daterange', 'date_rangeye9vcz9z');
    const COL_PER_TYPE   = cfgGet('monday_col_permissions_type',      'single_selectogxov2i');
    const COL_PER_TYPE2  = cfgGet('monday_col_permissions_type_alt',  'single_select889imtb');
    const colText = (cols: Record<string, unknown>[], id: string) =>
      String((cols.find(c => (c as Record<string, unknown>).id === id) as Record<string, unknown> | undefined)?.text ?? '');
    const colValue = (cols: Record<string, unknown>[], id: string) => {
      const col = cols.find(c => (c as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
      if (!col?.value) return null;
      try { return JSON.parse(col.value as string); } catch { return null; }
    };
    for (const item of attendanceItems) {
      const i = item as Record<string, unknown>;
      const cols = (i.column_values as Record<string, unknown>[]) || [];
      const nameSrc = (i.name as string) || '';
      const emailRaw = colText(cols, COL_ATT_EMAIL) || (colValue(cols, COL_ATT_EMAIL) as Record<string, string> | null)?.email || '';
      const email = emailRaw.toLowerCase().trim();
      const dateRaw = colText(cols, COL_ATT_DATE).slice(0, 10) || (colValue(cols, COL_ATT_DATE) as Record<string, string> | null)?.date || '';
      const typeText = colText(cols, COL_ATT_TYPE);
      const reasonRaw = colText(cols, COL_ATT_REASON);
      if ((nameSrc || email) && dateRaw) attendance.push({ employeeName: nameSrc, employeeEmail: email || undefined, date: dateRaw, type: typeText.toLowerCase().includes('absence') ? 'Absence' : 'Tardiness', reason: reasonRaw, notes: '' });
    }
    for (const item of adjustmentsItems) {
      const i = item as Record<string, unknown>;
      const cols = (i.column_values as Record<string, unknown>[]) || [];
      const nameSrc = (i.name as string) || '';
      const emailRaw = colText(cols, COL_ADJ_EMAIL) || (colValue(cols, COL_ADJ_EMAIL) as Record<string, string> | null)?.email || '';
      const email = emailRaw.toLowerCase().trim();
      const dateRaw = colText(cols, COL_ADJ_DATE).slice(0, 10) || (colValue(cols, COL_ADJ_DATE) as Record<string, string> | null)?.date || '';
      const typeText = colText(cols, COL_ADJ_TYPE);
      if ((nameSrc || email) && dateRaw) adjustments.push({ employeeName: nameSrc, employeeEmail: email || undefined, date: dateRaw, adjustmentType: typeText });
    }
    for (const item of permissionsItems) {
      const i = item as Record<string, unknown>;
      const cols = (i.column_values as Record<string, unknown>[]) || [];
      const nameSrc = (i.name as string) || '';
      const emailRaw = colText(cols, COL_PER_EMAIL) || (colValue(cols, COL_PER_EMAIL) as Record<string, string> | null)?.email || '';
      const email = emailRaw.toLowerCase().trim();
      const dateRangeVal = colValue(cols, COL_PER_RANGE) as { from?: string; to?: string } | null;
      const dateRangeText = colText(cols, COL_PER_RANGE);
      const from = dateRangeVal?.from || dateRangeText.slice(0, 10) || '';
      const to = dateRangeVal?.to || dateRangeVal?.from || from;
      const requestType = colText(cols, COL_PER_TYPE) || colText(cols, COL_PER_TYPE2);
      if ((nameSrc || email) && from) permissions.push({ employeeName: nameSrc, employeeEmail: email || undefined, startDate: from.slice(0, 10), endDate: (to || from).slice(0, 10), requestType, status: 'Approved' });
    }
    return { attendance, adjustments, permissions };
  };

  const fetchAllBoardItems = async (boardId: number): Promise<unknown[]> => {
    const allItems: unknown[] = [];
    let cursor: string | null = null;
    do {
      const cursorArg = cursor ? `, cursor: "${cursor}"` : '';
      const query = `{ boards(ids: [${boardId}]) { items_page(limit: 500${cursorArg}) { cursor items { id name column_values { id text value } } } } }`;
      const result = await pullBoard({ query, variables: null }) as Record<string, unknown>;
      const data = (result?.data ?? result) as Record<string, unknown>;
      const boards = (data?.boards ?? (data?.data as Record<string, unknown>)?.boards) as unknown[];
      if (!boards?.length) break;
      const board = boards[0] as Record<string, unknown>;
      const page = board?.items_page as Record<string, unknown>;
      allItems.push(...((page?.items as unknown[]) || []));
      cursor = (page?.cursor as string) || null;
    } while (cursor);
    return allItems;
  };

  const handleRun = async () => {
    if (!periodName || !startDate || !endDate || !teramindFile) {
      setError('Complete all required fields: Period Name, Start Date, End Date, and Teramind file.');
      return;
    }
    setError('');
    setRunLog([]);
    setProgress(5);
    setResult(null);
    setStatus('preflight');

    try {
      if (isRerun) {
        const empName = singleEmpMode && singleEmpIds.length > 0
          ? singleEmpIds.map(id => (employees as Employee[]).find(e => e.id === id)?.display_name ?? `#${id}`).join(', ')
          : null;
        const msg = empName
          ? `Re-run for: ${empName} — their entries will be overwritten. Everyone else's work is preserved. Continue?`
          : `"${periodName}" already has data. Re-running will regenerate and update entries for this period — resolved work will be overwritten. Rows the engine no longer generates are left in place, not removed. Continue?`;
        const ok = window.confirm(msg);
        if (!ok) { setStatus('idle'); setProgress(0); return; }
      }

      log('Parsing Teramind export…');
      const dstWindows = dstCalendar as DstWindow[];
      const tmResolver = buildTeramindResolverMap();
      const knownEmails = new Set((employees as Employee[]).map(e => e.teramind_email.toLowerCase()));
      const tmMap = processTeramindData(teramindRows, dstWindows, tmResolver, knownEmails);
      log(`Teramind: ${teramindRows.length} raw rows → ${tmMap.size} employees resolved.`);
      setProgress(20);

      log('Pulling Monday.com boards…');
      const [attendanceItems, adjustmentsItems, permissionsItems] = await Promise.all([
        fetchAllBoardItems(BOARD_ATTENDANCE),
        fetchAllBoardItems(BOARD_ADJUSTMENTS),
        fetchAllBoardItems(BOARD_PERMISSIONS),
      ]);
      log(`Monday: ${attendanceItems.length} attendance · ${adjustmentsItems.length} adjustments · ${permissionsItems.length} permissions.`);
      setProgress(40);

      const { attendance, adjustments, permissions } = parseMondayItems(attendanceItems, adjustmentsItems, permissionsItems);
      log(`Parsed: ${attendance.length} attendance · ${adjustments.length} adjustments · ${permissions.length} permissions.`);

      await saveSnapshot({ periodName, snapshotType: 'teramind', rawData: JSON.stringify(teramindRows.slice(0, 100)) });
      await saveSnapshot({ periodName, snapshotType: 'monday_attendance', rawData: JSON.stringify(attendance) });
      await saveSnapshot({ periodName, snapshotType: 'monday_permissions', rawData: JSON.stringify(permissions) });

      // Data quality checks
      const warnings: DataWarning[] = [];
      if (missingCfgKeys.size > 0) {
        warnings.push({ level: 'warn', message: `Using built-in Monday IDs for ${missingCfgKeys.size} setting(s) missing from Rules & Config: ${[...missingCfgKeys].join(', ')}` });
      }
      const activeEmps = employees as Employee[];
      const periodStart = new Date(startDate + 'T12:00:00');
      const periodEnd = new Date(endDate + 'T12:00:00');
      const periodDates: Date[] = [];
      for (const d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
        periodDates.push(new Date(d));
      }
      const tmEmailsSet = new Set(tmMap.keys());
      const missingTm = activeEmps.filter(e => e.teramind_email && !tmEmailsSet.has(e.teramind_email.toLowerCase()));
      if (missingTm.length > 0) warnings.push({ level: 'warn', message: `${missingTm.length} active employee(s) have no Teramind data: ${missingTm.map(e => e.display_name).join(', ')}` });
      for (const emp of activeEmps) {
        if (!emp.teramind_email) continue;
        const dayMap = tmMap.get(emp.teramind_email.toLowerCase());
        if (!dayMap) continue;
        const expectedWorkdays = periodDates.filter(d => isScheduledWorkDay(d, emp.work_days)).map(d => toLocalYMD(d));
        if (expectedWorkdays.length === 0) continue;
        const covered = expectedWorkdays.filter(d => dayMap.has(d)).length;
        const gap = expectedWorkdays.length - covered;
        if (gap > 0 && gap / expectedWorkdays.length > 0.3) warnings.push({ level: 'warn', message: `${emp.display_name}: Teramind covers only ${covered}/${expectedWorkdays.length} workdays.` });
      }
      if (attendanceItems.length === 0) warnings.push({ level: 'warn', message: 'Attendance board returned 0 items — no tardiness/absence data.' });
      if (adjustmentsItems.length === 0) warnings.push({ level: 'warn', message: 'Time Adjustments board returned 0 items.' });
      if (permissionsItems.length === 0) warnings.push({ level: 'warn', message: 'Permissions board returned 0 items — no PTO/permission data.' });
      const allMondayDates = [...attendance.map(r => r.date), ...adjustments.map(r => r.date), ...permissions.map(r => r.startDate)];
      const outRange = allMondayDates.filter(d => d && (d < startDate || d > endDate)).length;
      if (outRange > 0) warnings.push({ level: 'warn', message: `${outRange} Monday item(s) fall outside the period range and will be ignored.` });
      const tmDates = teramindRows.map(r => r.timeStarted?.slice(0, 10)).filter(Boolean);
      const tmMin = tmDates.length ? tmDates.reduce((a, b) => a < b ? a : b) : null;
      const tmMax = tmDates.length ? tmDates.reduce((a, b) => a > b ? a : b) : null;
      if (tmMin && tmMin > startDate) warnings.push({ level: 'warn', message: `Teramind file starts ${tmMin} but period starts ${startDate}.` });
      if (tmMax && tmMax < endDate) warnings.push({ level: 'warn', message: `Teramind file ends ${tmMax} but period ends ${endDate}.` });

      // Name resolution
      log('Resolving employee names…');
      const empEmails = new Set(activeEmps.map(e => e.teramind_email.toLowerCase()));
      const unresolved: UnmappedName[] = [];
      for (const resolvedEmail of tmMap.keys()) {
        if (!empEmails.has(resolvedEmail) && !unresolved.some(u => u.name === resolvedEmail)) {
          unresolved.push({ name: resolvedEmail, source: 'teramind' });
        }
      }

      if (unresolved.length > 0) {
        setUnmapped(unresolved);
        setMappings(unresolved.map(u => ({ name: u.name, employeeId: null, ignore: false })));
        setStashedMonday({ attendance, adjustments, permissions });
        setStatus('mapping');
        return;
      }

      if (warnings.length > 0) {
        setDataWarnings(warnings);
        setStashedMonday({ attendance, adjustments, permissions });
        setStatus('warnings');
        return;
      }

      await runEngine(tmMap, attendance, adjustments, permissions, buildNameMap());
    } catch (e) {
      setError(String(e));
      setStatus('error');
      setProgress(0);
    }
  };

  const runEngine = async (
    tmMap: ReturnType<typeof processTeramindData>,
    attendance: MondayAttendanceRow[],
    adjustments: MondayAdjustmentRow[],
    permissions: MondayPermissionRow[],
    nameMap: Map<string, number>
  ) => {
    setStatus('running');
    log('Running classification engine…');
    setProgress(50);

    const allEntries = runClassificationEngine({
      periodName,
      startDate,
      endDate,
      employees: employees as EmployeeRecord[],
      dstWindows: dstCalendar as DstWindow[],
      holidays: holidays as { date: string; name: string }[],
      teramindData: tmMap,
      mondayAttendance: attendance,
      mondayAdjustments: adjustments,
      mondayPermissions: permissions,
      outageDates,
      midDayPull,
      midDayPullDate: midDayPull
        ? (teramindMaxDate ?? new Date().toLocaleDateString('en-CA'))
        : undefined,
      excludedEmployeeIds: excludedIds,
      nameMap,
      config: buildClassificationConfig(cfgRows),
    });

    const entries = singleEmpMode && singleEmpIds.length > 0
      ? allEntries.filter(e => singleEmpIds.includes(e.employee_id))
      : allEntries;

    if (singleEmpMode && singleEmpIds.length > 0) {
      const names = singleEmpIds.map(id => (employees as Employee[]).find(e => e.id === id)?.display_name ?? `#${id}`).join(', ');
      log(`Single-employee mode: processing only ${names} (${entries.length} entries).`);
    }

    log(`Engine produced ${entries.length} entries. Saving to database…`);
    let green = 0, yellow = 0, red = 0, saved = 0;
    const BATCH = 5;
    for (let i = 0; i < entries.length; i += BATCH) {
      await Promise.all(entries.slice(i, i + BATCH).map(e => upsertEntry(e)));
      saved += Math.min(BATCH, entries.length - i);
      setProgress(50 + Math.round((saved / entries.length) * 45));
      for (const e of entries.slice(i, i + BATCH)) {
        if (e.initial_status === 'GREEN') green++;
        else if (e.initial_status === 'YELLOW') yellow++;
        else red++;
      }
      if (Math.floor(saved / 50) > Math.floor((saved - BATCH) / 50)) log(`Saved ${saved}/${entries.length} entries…`);
    }

    if (!singleEmpMode) {
      const empCount = new Set(entries.map(e => e.employee_id)).size;
      const dayCount = new Set(entries.map(e => e.work_date)).size;
      await upsertPer({ period_name: periodName, start_date: startDate, end_date: endDate, employee_count: empCount, day_count: dayCount, green_count: green, yellow_count: yellow, red_count: red });
      bumpPeriodsVersion();
    }

    log(`✓ Done — ${green} GREEN · ${yellow} YELLOW · ${red} RED`);
    setResult({ green, yellow, red, total: green + yellow + red });
    setProgress(100);
    setStatus('done');
    await reloadPeriods();
    reloadUnresolved();
  };

  const handleMappingSave = async () => {
    setStatus('running');
    setError('');
    try {
      for (const m of mappings) if (!m.ignore && m.employeeId) await saveName({ aliasText: m.name, employeeId: m.employeeId });
      const newMap = buildNameMap(mappings.filter(m => !m.ignore));
      log('Re-fetching Monday.com data after alias mapping…');
      const tmResolver2 = buildTeramindResolverMap();
      const knownEmails2 = new Set((employees as Employee[]).map(e => e.teramind_email.toLowerCase()));
      const tmMap = processTeramindData(teramindRows, dstCalendar as DstWindow[], tmResolver2, knownEmails2);

      if (stashedMonday) {
        await runEngine(tmMap, stashedMonday.attendance, stashedMonday.adjustments, stashedMonday.permissions, newMap);
      } else {
        const [ai, aji, pi] = await Promise.all([fetchAllBoardItems(BOARD_ATTENDANCE), fetchAllBoardItems(BOARD_ADJUSTMENTS), fetchAllBoardItems(BOARD_PERMISSIONS)]);
        const { attendance, adjustments, permissions } = parseMondayItems(ai, aji, pi);
        await runEngine(tmMap, attendance, adjustments, permissions, newMap);
      }
    } catch (e) {
      setError(String(e));
      setStatus('mapping');
    }
  };

  const filteredEmps = useMemo(() =>
    (employees as Employee[]).filter(e =>
      !empSearch || e.display_name.toLowerCase().includes(empSearch.toLowerCase())
    ), [employees, empSearch]);

  const teramindMaxDate = useMemo(() => {
    const dates = teramindRows.map(r => r.timeStarted?.slice(0, 10)).filter(Boolean);
    return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
  }, [teramindRows]);

  const formReady = periodName && startDate && endDate && teramindFile && (!singleEmpMode || singleEmpIds.length > 0);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* ── Left: main workflow ─────────────────────────────── */}
      <div className="flex-1 min-w-0 p-4 xl:p-6 overflow-auto">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <PlayCircle className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-muted-foreground">Pull Monday data + classify Teramind time records</p>
        </div>

        {/* ── Step 1: Period ──────────────────────────────── */}
        <StepCard number={1} icon={<Calendar className="w-4 h-4" />} title="Pay Period" complete={!!(periodName && startDate && endDate)}>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div className="col-span-1">
              <label className="text-xs font-medium block mb-1 text-slate-600">Period Name *</label>
              <input
                className={`w-full border rounded-md px-3 py-2 text-sm ${isRerun ? 'border-amber-400 bg-amber-50' : ''}`}
                placeholder="e.g. Q3-Jun-2026"
                value={periodName}
                onChange={e => setPeriodName(e.target.value)}
                disabled={isRunning}
              />
              {isRerun && (
                <div className="mt-1 space-y-1.5">
                  <p className="text-[11px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> This period already exists — re-run will regenerate and update entries; resolved work will be overwritten, but rows the engine no longer generates are left in place.
                  </p>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-700">
                    <input
                      type="checkbox"
                      className="w-3 h-3 accent-blue-600"
                      checked={singleEmpMode}
                      onChange={e => { setSingleEmpMode(e.target.checked); setSingleEmpIds([]); setSingleEmpSearch(''); }}
                      disabled={isRunning}
                    />
                    <span className="font-medium">Re-run for one employee only</span>
                    <span className="text-muted-foreground">(preserves everyone else's resolved work)</span>
                  </label>
                  {singleEmpMode && (
                    <div className="mt-1 border rounded-lg p-2 bg-blue-50/60 space-y-1">
                      <p className="text-[11px] font-medium text-blue-800">Select employee to re-process:</p>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        <input
                          className="w-full border rounded pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
                          placeholder="Search employee…"
                          value={singleEmpSearch}
                          onChange={e => setSingleEmpSearch(e.target.value)}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="max-h-32 overflow-y-auto border rounded bg-white">
                        {(employees as Employee[])
                          .filter(e => !singleEmpSearch || e.display_name.toLowerCase().includes(singleEmpSearch.toLowerCase()))
                          .map(e => (
                            <label key={e.id}
                              className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors ${singleEmpIds.includes(e.id) ? 'bg-blue-100 font-semibold text-blue-800' : ''}`}>
                              <input
                                type="checkbox"
                                className="w-3 h-3 accent-blue-600"
                                checked={singleEmpIds.includes(e.id)}
                                onChange={() => setSingleEmpIds(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id])}
                                disabled={isRunning}
                              />
                              {e.display_name}
                            </label>
                          ))}
                      </div>
                      {singleEmpIds.length > 0 && (
                        <p className="text-[11px] text-blue-700 font-medium">
                          ✓ Will re-process ({singleEmpIds.length}): {singleEmpIds.map(id => (employees as Employee[]).find(e => e.id === id)?.display_name).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium block mb-1 text-slate-600">Start Date *</label>
              <input type="date" className="w-full border rounded-md px-3 py-2 text-sm"
                value={startDate} onChange={e => setStartDate(e.target.value)} disabled={isRunning} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1 text-slate-600">End Date *</label>
              <input type="date" className="w-full border rounded-md px-3 py-2 text-sm"
                value={endDate} onChange={e => setEndDate(e.target.value)} disabled={isRunning} />
            </div>
          </div>

          {/* Quick-fill from recent period */}
          {existingPeriods.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick fill from:</span>
              <select className="border rounded px-2 py-1 text-xs bg-white"
                onChange={e => {
                  const p = existingPeriods.find(x => x.period_name === e.target.value);
                  if (p) {
                    setPeriodName(p.period_name);
                    setStartDate(p.start_date?.slice(0, 10) || '');
                    setEndDate(p.end_date?.slice(0, 10) || '');
                  }
                  e.target.value = '';
                }}
                defaultValue="">
                <option value="">— pick a previous period —</option>
                {existingPeriods.slice(0, 6).map(p => <option key={p.period_name} value={p.period_name}>{p.period_name}</option>)}
              </select>
            </div>
          )}
        </StepCard>

        {/* ── Step 2: Teramind file ───────────────────────── */}
        <StepCard number={2} icon={<FileText className="w-4 h-4" />} title="Teramind Export" complete={!!teramindFile}>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />

          {!teramindFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">Drop CSV/XLSX here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Teramind time records export</p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-green-50 border-green-200 flex items-start gap-3">
              <FileText className="w-8 h-8 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 truncate">{teramindFile.name}</p>
                <p className="text-xs text-green-700 mt-0.5">{teramindRows.length.toLocaleString()} rows parsed</p>
                {teramindRows.length > 0 && startDate && endDate && (() => {
                  const dates = teramindRows.map(r => r.timeStarted?.slice(0, 10)).filter(Boolean);
                  const min = dates.reduce((a, b) => a < b ? a : b, '');
                  const max = dates.reduce((a, b) => a > b ? a : b, '');
                  return <p className="text-xs text-green-600 mt-0.5">Coverage: {min} → {max}</p>;
                })()}
              </div>
              <button onClick={() => { setTeramindFile(null); setTeramindRows([]); }} disabled={isRunning}
                className="text-green-600 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" className="w-3.5 h-3.5" checked={midDayPull}
                onChange={e => setMidDayPull(e.target.checked)} disabled={isRunning} />
              <span className="font-medium text-slate-700">Export pulled mid-day</span>
              <span className="text-muted-foreground text-xs">— fills missing exits with each employee's scheduled end</span>
            </label>
          </div>
        </StepCard>

        {/* ── Step 3: Options ─────────────────────────────── */}
        <StepCard number={3} icon={<Settings2 className="w-4 h-4" />} title="Options" complete={false} optional collapsible>
          {/* Outage dates */}
          <div className="mb-4">
            <label className="text-xs font-medium block mb-1.5 text-slate-600">
              System Outage Dates
              <span className="font-normal text-muted-foreground ml-1">— employees get GREEN instead of absent flag</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input type="date" className="border rounded-md px-2 py-1.5 text-sm"
                value={outageInput} onChange={e => setOutageInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOutageDate()} disabled={isRunning} />
              <Button size="sm" variant="outline" onClick={addOutageDate}
                disabled={!outageInput || isRunning}>Add Date</Button>
            </div>
            {outageDates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {outageDates.map(d => (
                  <span key={d} className="flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-mono">
                    {d}
                    <button onClick={() => setOutageDates(prev => prev.filter(x => x !== d))} className="hover:text-red-600"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No outage dates — add if there was a Teramind outage during the period.</p>
            )}
          </div>

          {/* Employee exclusions */}
          <div>
            <label className="text-xs font-medium block mb-1.5 text-slate-600">
              Exclude Employees This Run
              {excludedIds.length > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">{excludedIds.length} excluded</Badge>}
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input className="w-full border rounded-md pl-8 py-1.5 text-sm" placeholder="Filter employees…"
                value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
            </div>
            <div className="border rounded-md max-h-40 overflow-y-auto grid grid-cols-2 gap-0">
              {filteredEmps.map(emp => (
                <label key={emp.id}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-b border-r hover:bg-slate-50 transition-colors ${excludedIds.includes(emp.id) ? 'bg-red-50 text-red-700 line-through' : ''}`}>
                  <input type="checkbox" className="w-3 h-3"
                    checked={excludedIds.includes(emp.id)}
                    onChange={() => toggleExclude(emp.id)} disabled={isRunning} />
                  {emp.display_name}
                </label>
              ))}
            </div>
            {excludedIds.length > 0 && (
              <button onClick={() => setExcludedIds([])} className="text-xs text-red-500 hover:underline mt-1">Clear all exclusions</button>
            )}
          </div>
        </StepCard>

        {/* ── Run button ──────────────────────────────────── */}
        {status !== 'mapping' && status !== 'warnings' && status !== 'done' && (
          <div className="mt-2">
            {missingCfgKeys.size > 0 && (
              <div
                className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3 text-sm text-red-700"
                title={`Missing keys:\n${[...missingCfgKeys].join('\n')}`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <div>
                  <div>Using built-in Monday IDs for {missingCfgKeys.size} setting(s) missing from Rules &amp; Config.</div>
                  <div className="text-red-500 text-xs mt-0.5">The run may read the wrong board. Add the missing keys in Admin → Rules &amp; Config.</div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3 text-sm text-red-700">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                {error}
              </div>
            )}
            <Button size="lg" onClick={handleRun}
              disabled={isRunning || !formReady}
              className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700">
              {isRunning
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Processing…</>
                : <><PlayCircle className="w-5 h-5 mr-2" />Pull Monday Data & Run Engine</>}
            </Button>
            {!formReady && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Complete Period Name, dates, and upload the Teramind file to continue.
              </p>
            )}
          </div>
        )}

        {/* ── Progress + Log ─────────────────────────────── */}
        {(isRunning || runLog.length > 0) && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            {isRunning && (
              <div className="h-1.5 bg-slate-100">
                <div className="h-full bg-blue-500 transition-all duration-500 rounded-r" style={{ width: `${progress}%` }} />
              </div>
            )}
            <div className="bg-slate-900 p-3 max-h-44 overflow-y-auto">
              {runLog.map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-mono mb-0.5">
                  <span className="text-slate-500 shrink-0">{line.ts}</span>
                  <span className={line.text.startsWith('✓') ? 'text-green-400' : 'text-slate-300'}>{line.text}</span>
                </div>
              ))}
              {isRunning && (
                <div className="flex items-center gap-2 text-xs text-blue-400 font-mono mt-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Working…
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Data warnings ──────────────────────────────── */}
        {status === 'warnings' && dataWarnings.length > 0 && (
          <div className="mt-4 border border-amber-300 rounded-lg overflow-hidden">
            <div className="bg-amber-50 px-4 py-3 flex items-center gap-2 border-b border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">Data Quality Warnings — Review Before Proceeding</span>
            </div>
            <div className="p-4 space-y-2">
              {dataWarnings.map((w, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded border ${w.level === 'error' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  {w.level === 'error' ? <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  {w.message}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    if (stashedMonday) {
                      const tr = buildTeramindResolverMap();
                      const ke = new Set((employees as Employee[]).map(e => e.teramind_email.toLowerCase()));
                      const tm = processTeramindData(teramindRows, dstCalendar as DstWindow[], tr, ke);
                      void runEngine(tm, stashedMonday.attendance, stashedMonday.adjustments, stashedMonday.permissions, buildNameMap());
                    }
                  }}>
                  Proceed Anyway
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => { setStatus('idle'); setDataWarnings([]); setStashedMonday(null); }}>
                  Cancel & Fix Data
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Name mapping ───────────────────────────────── */}
        {status === 'mapping' && (
          <div className="mt-4 border border-amber-300 rounded-lg overflow-hidden">
            <div className="bg-amber-50 px-4 py-3 flex items-center gap-2 border-b border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-800 text-sm">
                {unmapped.length} Unresolved Name{unmapped.length > 1 ? 's' : ''} — Map Before Running
              </span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-amber-700">These identifiers couldn't be matched to an employee. Mappings are saved permanently as Name Aliases.</p>
              {mappings.map((m, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-lg border ${m.ignore ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
                  <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded flex-1 min-w-0 truncate" title={m.name}>{m.name}</code>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  {m.ignore ? (
                    <span className="text-xs text-slate-500 italic flex-1">Ignored</span>
                  ) : (
                    <select className="border rounded-md px-2 py-1 text-xs flex-1"
                      value={m.employeeId ?? ''}
                      onChange={e => setMappings(prev => prev.map((x, i) => i === idx ? { ...x, employeeId: e.target.value ? Number(e.target.value) : null } : x))}>
                      <option value="">— Select employee —</option>
                      {(employees as Employee[]).map(emp => <option key={emp.id} value={emp.id}>{emp.display_name}</option>)}
                    </select>
                  )}
                  {!m.ignore && (m.employeeId ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : <X className="w-4 h-4 text-red-400 shrink-0" />)}
                  <button
                    className={`text-xs px-2 py-1 rounded border shrink-0 transition-colors ${m.ignore ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100' : 'bg-white border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-700'}`}
                    onClick={() => setMappings(prev => prev.map((x, i) => i === idx ? { ...x, ignore: !x.ignore, employeeId: null } : x))}>
                    {m.ignore ? 'Undo' : 'Ignore'}
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleMappingSave}
                  disabled={isRunning || mappings.some(m => !m.ignore && !m.employeeId)}>
                  {isRunning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save & Run Engine
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus('idle')} disabled={isRunning}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Result ─────────────────────────────────────── */}
        {status === 'done' && result && (
          <div className="mt-4 border border-green-300 rounded-xl overflow-hidden bg-green-50">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-green-200">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-800">Run complete — "{periodName}"</p>
                <p className="text-xs text-green-600">{result.total} entries classified across {(employees as Employee[]).length} employees</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {([['GREEN', result.green, 'bg-[#C6EFCE] text-green-800'], ['YELLOW', result.yellow, 'bg-[#FFEB9C] text-yellow-800'], ['RED', result.red, 'bg-[#FFC7CE] text-red-800']] as [string, number, string][]).map(([label, count, cls]) => (
                  <div key={label} className={`rounded-lg p-3 text-center ${cls}`}>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs font-semibold">{label}</div>
                  </div>
                ))}
              </div>
              {(result.yellow + result.red) > 0 ? (
                <Button size="sm" className="w-full" onClick={() => navigate('/action-required')}>
                  <ArrowRight className="w-4 h-4 mr-2" />Review {result.yellow + result.red} items in Action Required
                </Button>
              ) : (
                <p className="text-sm text-center text-green-700 font-medium">🎉 All entries are GREEN — nothing to resolve!</p>
              )}
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Run failed</p>
              <p className="text-xs text-red-600 mt-1 font-mono">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: recent runs panel ─────────────────────── */}
      <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 border-l bg-slate-50/60 flex-col overflow-hidden">
        <div className="px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Recent Periods</span>
            <Badge variant="outline" className="ml-auto text-xs">{existingPeriods.length}</Badge>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {existingPeriods.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No periods processed yet.</p>
          )}
          {existingPeriods.map(p => (
            <PeriodCard key={p.period_name} p={p} unresolvedCount={unresolvedMap.get(p.period_name) ?? 0} onClick={() => navigate(`/payroll-master?period=${encodeURIComponent(p.period_name)}`)} />
          ))}
        </div>
        <div className="border-t p-3">
          <button onClick={() => navigate('/period-log')}
            className="flex items-center gap-2 text-xs text-blue-600 hover:underline w-full justify-center">
            <TrendingUp className="w-3.5 h-3.5" />View full Period Log
          </button>
        </div>
      </aside>
    </div>
  );
}

// ── StepCard ──────────────────────────────────────────────────────────────────

function StepCard({ number, icon, title, complete, optional = false, collapsible = false, children }: {
  number: number; icon: React.ReactNode; title: string;
  complete: boolean; optional?: boolean; collapsible?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div className={`mb-4 border rounded-xl overflow-hidden transition-colors ${complete ? 'border-green-300' : 'border-slate-200'}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 border-b ${complete ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'} ${collapsible ? 'cursor-pointer select-none' : ''}`}
        onClick={() => collapsible && setOpen(o => !o)}
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${complete ? 'bg-green-500 text-white' : 'bg-white border-2 border-slate-300 text-slate-500'}`}>
          {complete ? <CheckCircle className="w-3.5 h-3.5" /> : number}
        </div>
        <span className={`text-sm font-semibold ${complete ? 'text-green-800' : 'text-slate-700'}`}>{title}</span>
        <span className="ml-1 text-muted-foreground">{icon}</span>
        {optional && <Badge variant="outline" className="ml-2 text-[10px] font-normal">Optional</Badge>}
        {collapsible && (
          <ChevronRight className={`w-4 h-4 ml-auto text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        )}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}
