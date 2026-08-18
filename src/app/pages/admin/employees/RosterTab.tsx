import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import {
  Users, Plus, Loader2, Save, Search, X,
  Clock, Laptop, Ban, CheckCircle2, LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadSchedulesAction from '@/actions/loadSchedules';
import upsertEmployeeAction from '@/actions/upsertEmployee';
import updateEmployeeFlagAction from '@/actions/updateEmployeeFlag';

type EmpRow = {
  id: number; display_name: string; teramind_email: string; company_domain: string;
  is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean;
  active: boolean; start_date: string; end_date: string; notes: string;
  schedule_name: string; schedule_id: number;
};
type Schedule = { id: number; schedule_name: string };

const EMPTY_EMP: Partial<EmpRow> = {
  display_name: '', teramind_email: '', company_domain: '',
  schedule_id: 0, is_grace_list: false, is_macbook_swap: false,
  excluded_from_payroll: false, active: true, notes: '',
};

type FlagKey = 'is_grace_list' | 'is_macbook_swap' | 'excluded_from_payroll' | 'active';

const FLAG_META: { key: FlagKey; label: string; icon: LucideIcon; tip: string; danger?: boolean }[] = [
  { key: 'is_grace_list',         label: 'Grace',    icon: Clock,        tip: 'Gets 10-min tardiness grace period before flagging' },
  { key: 'is_macbook_swap',       label: 'Macbook',  icon: Laptop,       tip: 'Missing Teramind data defaults to GREEN (not flagged absent)' },
  { key: 'excluded_from_payroll', label: 'Excluded', icon: Ban,          tip: 'Skipped entirely during payroll processing runs', danger: true },
  { key: 'active',                label: 'Active',   icon: CheckCircle2, tip: 'Inactive employees are excluded from payroll runs', danger: true },
];

export default function RosterTab() {
  const [employees, , , reload] = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);
  const [schedules] = useLoadAction(loadSchedulesAction, [] as Schedule[]);
  const [upsertEmp, saving] = useMutateAction(upsertEmployeeAction);
  const [updateFlag] = useMutateAction(updateEmployeeFlagAction);

  const [editing, setEditing] = useState<Partial<EmpRow> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  const handleNew  = () => { setEditing({ ...EMPTY_EMP }); setShowForm(true); };
  const handleEdit = (emp: EmpRow) => { setEditing({ ...emp }); setShowForm(true); };

  const handleSave = async () => {
    if (!editing) return;
    await upsertEmp({ ...editing, excluded_from_payroll: editing.excluded_from_payroll ?? false });
    setShowForm(false);
    setEditing(null);
    await reload();
  };

  const handleToggle = async (emp: EmpRow, key: FlagKey) => {
    const newVal = !emp[key];
    if (key === 'active' && newVal === false) {
      if (!window.confirm(`Deactivate "${emp.display_name}"? They will be excluded from future payroll runs.`)) return;
    }
    await updateFlag({
      id: emp.id,
      is_grace_list:         key === 'is_grace_list'         ? newVal : emp.is_grace_list,
      is_macbook_swap:       key === 'is_macbook_swap'       ? newVal : emp.is_macbook_swap,
      excluded_from_payroll: key === 'excluded_from_payroll' ? newVal : emp.excluded_from_payroll,
      active:                key === 'active'                ? newVal : emp.active,
    });
    await reload();
  };

  const emps = employees as EmpRow[];
  const filtered = emps.filter(e => {
    const matchSearch = !search.trim()
      || e.display_name.toLowerCase().includes(search.toLowerCase())
      || e.teramind_email.toLowerCase().includes(search.toLowerCase());
    const matchActive = filterActive === 'all' || (filterActive === 'active' ? e.active : !e.active);
    return matchSearch && matchActive;
  });

  const activeCount   = emps.filter(e => e.active).length;
  const inactiveCount = emps.filter(e => !e.active).length;
  const excludedCount = emps.filter(e => e.excluded_from_payroll).length;

  return (
    <div className="p-6">
      {/* Header badges + Add button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          <Badge variant="outline"    className="text-xs">{activeCount} active</Badge>
          {inactiveCount > 0 && <Badge variant="secondary"    className="text-xs">{inactiveCount} inactive</Badge>}
          {excludedCount > 0 && <Badge variant="destructive"  className="text-xs">{excludedCount} excluded</Badge>}
        </div>
        <Button size="sm" onClick={handleNew}>
          <Plus className="w-4 h-4 mr-1.5" />Add Employee
        </Button>
      </div>

      {/* Edit / Add form */}
      {showForm && editing && (
        <Card className="mb-5 border-blue-300 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {editing.id ? `Editing: ${editing.display_name}` : 'New Employee'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {([
                ['display_name',   'Display Name'],
                ['teramind_email', 'Teramind Email'],
                ['company_domain', 'Company Domain'],
                ['notes',          'Notes'],
              ] as [keyof EmpRow, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs font-medium block mb-1 text-slate-600">{label}</label>
                  <input
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    value={(editing[field] as string) || ''}
                    onChange={e => setEditing(prev => ({ ...prev!, [field]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium block mb-1 text-slate-600">Schedule</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={editing.schedule_id || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, schedule_id: Number(e.target.value) }))}>
                  <option value="">— Select schedule —</option>
                  {(schedules as Schedule[]).map(s => (
                    <option key={s.id} value={s.id}>{s.schedule_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-4 mb-4 p-3 bg-slate-50 rounded-lg border">
              {FLAG_META.map(f => (
                <label key={f.key} title={f.tip} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5"
                    checked={!!editing[f.key]}
                    onChange={e => setEditing(prev => ({ ...prev!, [f.key]: e.target.checked }))}
                  />
                  <f.icon className={`w-3.5 h-3.5 ${f.danger ? 'text-red-500' : 'text-slate-500'}`} />
                  <span className={`text-sm ${f.danger ? 'text-red-700 font-medium' : 'text-slate-700'}`}>{f.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving
                  ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  : <Save    className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => { setShowForm(false); setEditing(null); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full border rounded-md pl-8 pr-8 py-2 text-sm bg-white"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {(['active', 'inactive', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-2 capitalize border-r last:border-r-0 font-medium transition-colors
                ${filterActive === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} shown</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto shadow-sm">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r whitespace-nowrap">Name</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r whitespace-nowrap">Teramind Email</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r whitespace-nowrap">Domain</th>
              <th className="px-3 py-2.5 text-left font-semibold border-b border-r whitespace-nowrap">Schedule</th>
              {FLAG_META.map(f => (
                <th key={f.key} title={f.tip}
                  className="px-3 py-2.5 text-center font-semibold border-b border-r whitespace-nowrap cursor-help">
                  <span className="flex items-center justify-center gap-1">
                    <f.icon className={`w-3 h-3 ${f.danger ? 'text-red-500' : 'text-slate-500'}`} />
                    {f.label}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 border-b w-14" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No employees match your filter.
                </td>
              </tr>
            )}
            {filtered.map(emp => (
              <tr
                key={emp.id}
                className={`border-b hover:bg-slate-50 transition-colors
                  ${!emp.active ? 'opacity-50' : ''}
                  ${emp.excluded_from_payroll ? 'bg-red-50/50' : ''}`}>
                <td className="px-3 py-2 border-r font-medium">{emp.display_name}</td>
                <td className="px-3 py-2 border-r text-slate-500 font-mono text-[11px]">{emp.teramind_email}</td>
                <td className="px-3 py-2 border-r text-slate-500">{emp.company_domain}</td>
                <td className="px-3 py-2 border-r">
                  {emp.schedule_name || <span className="text-slate-300 italic">none</span>}
                </td>
                {FLAG_META.map(f => (
                  <td key={f.key} className="px-3 py-2 border-r text-center">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 cursor-pointer"
                      checked={!!emp[f.key]}
                      onChange={() => handleToggle(emp, f.key)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center">
                  <Button size="sm" variant="outline" className="text-xs h-6 px-2"
                    onClick={() => handleEdit(emp)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {FLAG_META.map(f => (
          <span key={f.key} title={f.tip} className="cursor-help flex items-center gap-1.5">
            <f.icon className={`w-3 h-3 shrink-0 ${f.danger ? 'text-red-400' : 'text-slate-400'}`} />
            <span className={`font-medium ${f.danger ? 'text-red-700' : 'text-slate-700'}`}>{f.label}</span>
            <span>— {f.tip}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
