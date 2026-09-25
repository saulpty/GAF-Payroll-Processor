import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadSchedulesAction from '@/actions/loadSchedules';
import upsertEmployeeAction from '@/actions/upsertEmployee';
import updateEmployeeAction from '@/actions/updateEmployee';
import updateEmployeeFlagAction from '@/actions/updateEmployeeFlag';
import { EMPTY_EMP, FLAG_META, type EmpRow, type FlagKey, type Schedule } from './rosterTypes';
import { RosterForm } from './RosterForm';

export default function RosterTab() {
  const [employees, , , reload] = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);
  const [schedules] = useLoadAction(loadSchedulesAction, [] as Schedule[]);
  const [upsertEmp, saving] = useMutateAction(upsertEmployeeAction);
  const [updateEmp, updating] = useMutateAction(updateEmployeeAction);
  const [updateFlag] = useMutateAction(updateEmployeeFlagAction);

  const [editing, setEditing] = useState<Partial<EmpRow> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

  const handleNew  = () => { setSaveError(null); setEditing({ ...EMPTY_EMP }); setShowForm(true); };
  const handleEdit = (emp: EmpRow) => { setSaveError(null); setEditing({ ...emp }); setShowForm(true); };

  const handleSave = async () => {
    if (!editing) return;
    setSaveError(null);
    const email = (editing.teramind_email ?? '').trim().toLowerCase();
    const duplicate = emps.find(
      e => e.teramind_email.trim().toLowerCase() === email && e.id !== editing.id,
    );
    if (duplicate) {
      setSaveError(`That email already belongs to ${duplicate.display_name}. Nothing was saved.`);
      return;
    }
    try {
      if (typeof editing.id === 'number') {
        await updateEmp({
          id: editing.id,
          display_name: editing.display_name ?? '',
          teramind_email: email,
          company_domain: editing.company_domain ?? '',
          schedule_id: editing.schedule_id ?? 0,
          is_grace_list: editing.is_grace_list ?? false,
          is_macbook_swap: editing.is_macbook_swap ?? false,
          excluded_from_payroll: editing.excluded_from_payroll ?? false,
          active: editing.active ?? true,
          notes: editing.notes ?? '',
        });
      } else {
        await upsertEmp({ ...editing, teramind_email: email, excluded_from_payroll: editing.excluded_from_payroll ?? false });
      }
      setShowForm(false);
      setEditing(null);
      await reload();
    } catch (e: unknown) {
      setSaveError(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
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
        <RosterForm editing={editing} setEditing={setEditing} emps={emps} schedules={schedules as Schedule[]}
          saveError={saveError} busy={saving || updating} onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }} />
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
