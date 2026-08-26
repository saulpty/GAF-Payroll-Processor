import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Download, Calendar, RefreshCw, Save, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import loadHrkSummaryAction from '@/actions/loadHrkSummary';
import loadPeriodsAction from '@/actions/loadPeriods';
import saveHrkExportAction from '@/actions/saveHrkExport';
import PageHeader from '@/app/components/PageHeader';

// ── Types ─────────────────────────────────────────────────────────────────────

type HrkRow = {
  employee: string;
  hire_date: string | null;
  base_hours: number;
  total_worked_hours: number;
  total_discount_hours: number;
  incapacidad_days: number;
  incapacidad_dates: string;
  constancia_days: number;
  constancia_hours: number;
  constancia_dates_hours: string;
  pto_days: number;
  pto_dates: string;
  notes: string;
  needs_constancia_review: boolean;
};

type EditableFields = Pick<HrkRow,
  'incapacidad_days' | 'incapacidad_dates' |
  'constancia_days' | 'constancia_hours' | 'constancia_dates_hours' |
  'pto_days' | 'pto_dates' | 'notes'
>;

type Overrides = Record<string, Partial<EditableFields>>;
type PeriodOption = { period_name: string; start_date: string; end_date: string };

// ── CSV ───────────────────────────────────────────────────────────────────────

function escapeCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCsv(rows: HrkRow[]): string {
  const headers = [
    'Employee', 'Base Hours', 'Total Worked Hours', 'Total Discount Hours',
    'Incapacidad Days', 'Incapacidad Dates',
    'Constancia Médica Days', 'Constancia Médica Hours', 'Constancia Médica Dates & Hours',
    'PTO Days', 'PTO Dates', 'Hire Date', 'Notes',
  ];
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.employee,
      r.base_hours,
      r.total_worked_hours, r.total_discount_hours,
      r.incapacidad_days, r.incapacidad_dates,
      r.constancia_days, r.constancia_hours, r.constancia_dates_hours,
      r.pto_days, r.pto_dates,
      r.hire_date ? r.hire_date.slice(0, 10) : '', r.notes,
    ].map(escapeCsv).join(',')),
  ];
  return lines.join('\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HrkSummary() {
  const { period: globalPeriod } = useGlobalFilters();
  const [periods] = useLoadAction(loadPeriodsAction, [] as PeriodOption[]);
  const periodList = periods as PeriodOption[];

  const activePeriod = useMemo(
    () => globalPeriod || (periodList[0]?.period_name ?? ''),
    [globalPeriod, periodList]
  );

  const [rawData, loading, error, reload] = useLoadAction(
    loadHrkSummaryAction,
    [] as HrkRow[],
    { periodName: activePeriod },
    { enabled: activePeriod !== '' }
  );

  // ── Edit state ────────────────────────────────────────────────────────────
  const [overrides, setOverrides] = useState<Overrides>({});
  // saved baseline — undo reverts to this
  const [savedOverrides, setSavedOverrides] = useState<Overrides>({});
  const [dirtyEmployees, setDirtyEmployees] = useState<Set<string>>(new Set());

  // Reset when period changes
  useEffect(() => {
    setOverrides({});
    setSavedOverrides({});
    setDirtyEmployees(new Set());
  }, [activePeriod]);

  const rows = rawData as HrkRow[];

  const effectiveRows: HrkRow[] = useMemo(
    () => rows.map(r => ({ ...r, ...(overrides[r.employee] ?? {}) })),
    [rows, overrides]
  );

  const handleEdit = useCallback((employee: string, field: keyof EditableFields, value: string | number) => {
    setOverrides(prev => ({
      ...prev,
      [employee]: { ...(prev[employee] ?? {}), [field]: value },
    }));
    setDirtyEmployees(prev => new Set(prev).add(employee));
  }, []);

  const handleUndo = useCallback(() => {
    setOverrides(savedOverrides);
    setDirtyEmployees(new Set());
  }, [savedOverrides]);

  const handleSave = useCallback(() => {
    setSavedOverrides(overrides);
    setDirtyEmployees(new Set());
  }, [overrides]);

  const isDirty = dirtyEmployees.size > 0;

  // ── Export ────────────────────────────────────────────────────────────────
  const [saveExport, savingExport] = useMutateAction(saveHrkExportAction);
  const [exportError, setExportError] = useState('');

  const handleExport = useCallback(async () => {
    setExportError('');
    try {
      await saveExport({
        periodName: activePeriod,
        exportedBy: '',
        summaryJson: JSON.stringify(effectiveRows),
      });
      // Only download and clear after successful DB save
      downloadCsv(buildCsv(effectiveRows), `HRK_Summary_${activePeriod.replace(/\s+/g, '_')}.csv`);
      setOverrides({});
      setSavedOverrides({});
      setDirtyEmployees(new Set());
    } catch (e) {
      console.error(e);
      setExportError("Couldn't save the export — saveHrkExport. Nothing was downloaded and your edits are still here. Try again, and if it keeps failing, check the Period Log.");
    }
  }, [effectiveRows, activePeriod, saveExport]);


  // ── Stats ─────────────────────────────────────────────────────────────────
  const reviewFlags = effectiveRows.filter(r => r.needs_constancia_review);
  const hasMedical = effectiveRows.some(r => Number(r.incapacidad_days) > 0 || Number(r.constancia_days) > 0);
  const hasPto = effectiveRows.some(r => Number(r.pto_days) > 0);
  const totalDiscountHours = effectiveRows.reduce((s, r) => s + Number(r.total_discount_hours), 0);
  const totalIncapDays = effectiveRows.reduce((s, r) => s + Number(r.incapacidad_days), 0);
  const totalPtoDays = effectiveRows.reduce((s, r) => s + Number(r.pto_days), 0);

  const actionGroup = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 h-8 flex items-center rounded-md">
          {activePeriod || 'No period selected'}
        </span>
      </div>

      <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>

      {isDirty && (
        <>
          <Button variant="outline" size="sm" onClick={handleUndo}>
            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
            Undo
          </Button>
          <Button size="sm" onClick={handleSave} className="bg-secondary hover:bg-secondary/90">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save Edits
          </Button>
        </>
      )}

      <Button
        size="sm"
        disabled={effectiveRows.length === 0 || savingExport}
        onClick={handleExport}
      >
        <Download className={`w-3.5 h-3.5 mr-1.5 ${savingExport ? 'animate-spin' : ''}`} />
        {savingExport ? 'Saving…' : 'Export CSV'}
      </Button>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto pb-6">
      <PageHeader
        title="HRK Summary"
        subtitle="Payroll export for the HR consultant"
        actions={actionGroup}
      />
      <div className="px-6 space-y-5">

      {/* Alerts */}
      {exportError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{exportError}</p>
      )}
      {effectiveRows.length > 0 && effectiveRows.every(r => !r.hire_date) && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          ⚠ Hire dates are not set. Go to Admin → Directory Sync → "Sync Hire Dates" to pull from Monday.
        </p>
      )}
      {reviewFlags.length > 0 && (
        <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
          ⚠ {reviewFlags.length} employee{reviewFlags.length > 1 ? 's' : ''} have notes mentioning "constancia" but are not tagged Constancia Médica — manual review needed:{' '}
          {reviewFlags.map(r => r.employee).join(', ')}
        </p>
      )}

      {/* Stats */}
      {effectiveRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Employees" value={effectiveRows.length} />
          <StatCard label="Total Discount Hours" value={totalDiscountHours.toFixed(1) + 'h'} lead />
          <StatCard label="Incapacidad Days" value={totalIncapDays} highlight={hasMedical} />
          <StatCard label="PTO Days" value={totalPtoDays} highlight={hasPto} />
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            {activePeriod ? `Period: ${activePeriod}` : 'No period selected'}
            {effectiveRows.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({effectiveRows.length} employees)</span>
            )}
            {isDirty && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {dirtyEmployees.size} unsaved {dirtyEmployees.size === 1 ? 'edit' : 'edits'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />Loading…
            </div>
          )}
          {!loading && error && (
            <div className="py-10 text-center text-red-500 text-sm">Couldn't load the summary — loadHrkSummary. Try Refresh.</div>
          )}
          {!loading && !error && effectiveRows.length === 0 && activePeriod && (
            <div className="py-10 text-center text-slate-400 text-sm">No entries found for this period.</div>
          )}
          {!loading && effectiveRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <Th left>Employee</Th>
                    <Th>Base Hrs</Th>
                    <Th>Worked Hrs</Th>
                    <Th>Discount Hrs</Th>
                    <Th>Incap. Days</Th>
                    <Th left>Incapacidad Dates</Th>
                    <Th>Const. Days</Th>
                    <Th>Const. Hrs</Th>
                    <Th left>Const. Dates & Hrs</Th>
                    <Th>PTO Days</Th>
                    <Th left>PTO Dates</Th>
                    <Th left>Hire Date</Th>
                    <Th left>Notes</Th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveRows.map((r, i) => (
                    <HrkTableRow
                      key={r.employee}
                      row={r}
                      striped={i % 2 !== 0}
                      dirty={dirtyEmployees.has(r.employee)}
                      onEdit={handleEdit}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// ── Editable table row ────────────────────────────────────────────────────────

type HrkTableRowProps = {
  row: HrkRow;
  striped: boolean;
  dirty: boolean;
  onEdit: (employee: string, field: keyof EditableFields, value: string | number) => void;
};

function HrkTableRow({ row, striped, dirty, onEdit }: HrkTableRowProps) {
  const base = striped ? 'bg-slate-50/60' : 'bg-white';
  const dirtyRing = dirty ? 'outline outline-1 outline-amber-300' : '';

  return (
    <tr className={`${base} ${dirtyRing}`}>
      <Td left bold>
        {row.needs_constancia_review
          ? <span title="Constancia mentioned in notes but not tagged — review needed">⚠ {row.employee}</span>
          : row.employee}
      </Td>
      <Td muted>{row.base_hours}</Td>
      <Td>{row.total_worked_hours}</Td>
      <Td warn={Number(row.total_discount_hours) > 0}>{row.total_discount_hours}</Td>
      <TdEdit
        value={String(row.incapacidad_days)}
        type="number"
        warn={Number(row.incapacidad_days) > 0}
        onChange={v => onEdit(row.employee, 'incapacidad_days', Number(v))}
      />
      <TdEdit
        value={row.incapacidad_dates}
        left
        onChange={v => onEdit(row.employee, 'incapacidad_dates', v)}
      />
      <TdEdit
        value={String(row.constancia_days)}
        type="number"
        warn={Number(row.constancia_days) > 0}
        onChange={v => onEdit(row.employee, 'constancia_days', Number(v))}
      />
      <TdEdit
        value={String(row.constancia_hours)}
        type="number"
        warn={Number(row.constancia_hours) > 0}
        onChange={v => onEdit(row.employee, 'constancia_hours', Number(v))}
      />
      <TdEdit
        value={row.constancia_dates_hours}
        left
        onChange={v => onEdit(row.employee, 'constancia_dates_hours', v)}
      />
      <TdEdit
        value={String(row.pto_days)}
        type="number"
        info={Number(row.pto_days) > 0}
        onChange={v => onEdit(row.employee, 'pto_days', Number(v))}
      />
      <TdEdit
        value={row.pto_dates}
        left
        onChange={v => onEdit(row.employee, 'pto_dates', v)}
      />
      <Td left muted={!row.hire_date}>{row.hire_date ? row.hire_date.slice(0, 10) : '—'}</Td>
      <TdEdit
        value={row.notes}
        left
        onChange={v => onEdit(row.employee, 'notes', v)}
      />
    </tr>
  );
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th className={`px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap text-xs ${left ? 'text-left' : 'text-center'}`}>
      {children}
    </th>
  );
}

function Td({ children, left, bold, warn, info, muted }: {
  children: React.ReactNode;
  left?: boolean; bold?: boolean; warn?: boolean; info?: boolean; muted?: boolean;
}) {
  return (
    <td className={[
      'px-3 py-1.5 border-b border-slate-100 align-middle',
      left ? 'text-left' : 'text-center',
      bold ? 'font-medium text-slate-800' : '',
      warn ? 'text-amber-700 font-semibold' : '',
      info ? 'text-indigo-700 font-semibold' : '',
      muted ? 'text-slate-400' : 'text-slate-700',
    ].filter(Boolean).join(' ')}>
      {children}
    </td>
  );
}

function TdEdit({ value, left, type, warn, info, onChange }: {
  value: string;
  left?: boolean;
  type?: 'text' | 'number';
  warn?: boolean;
  info?: boolean;
  onChange: (v: string) => void;
}) {
  // derive color from value, not from a passed-in muted prop
  const colorCls = warn && value && value !== '0'
    ? 'text-amber-700'
    : info && value && value !== '0'
    ? 'text-indigo-700'
    : !value || value === '0'
    ? 'text-slate-400'
    : 'text-slate-700';

  return (
    <td className={`px-1 py-1 border-b border-slate-100 align-middle ${left ? 'text-left' : 'text-center'}`}>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full min-w-[56px] bg-transparent border border-transparent rounded px-2 py-0.5 text-xs focus:outline-none focus:border-indigo-300 focus:bg-white hover:border-slate-200 transition-colors ${colorCls}`}
      />
    </td>
  );
}

function StatCard({ label, value, highlight, lead }: { label: string; value: string | number; highlight?: boolean; lead?: boolean }) {
  const cardCls = lead
    ? 'rounded-lg border border-primary px-4 py-3 bg-white shadow-[inset_3px_0_0_var(--primary)]'
    : highlight
    ? 'rounded-lg border border-amber-300 px-4 py-3 bg-amber-50'
    : 'rounded-lg border border-slate-200 px-4 py-3 bg-white';
  const valueCls = highlight ? 'text-amber-700' : lead ? 'text-foreground' : 'text-slate-800';
  return (
    <div className={cardCls}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold tabular-nums tracking-tight mt-0.5 ${valueCls}`}>{value}</div>
    </div>
  );
}
