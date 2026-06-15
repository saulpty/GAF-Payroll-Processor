import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Clock, Plus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import updateEmployeeFlagAction from '@/actions/updateEmployeeFlag';

type EmpRow = { id: number; display_name: string; is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean; active: boolean };

export default function AdminGraceList() {
  const [employees, , , reload] = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);
  const [updateFlag] = useMutateAction(updateEmployeeFlagAction);
  const [addId, setAddId] = useState<number | ''>('');

  const graceList = (employees as EmpRow[]).filter(e => e.is_grace_list);
  const nonGrace = (employees as EmpRow[]).filter(e => !e.is_grace_list && e.active);

  const remove = async (emp: EmpRow) => {
    await updateFlag({ id: emp.id, is_grace_list: false, is_macbook_swap: emp.is_macbook_swap, excluded_from_payroll: emp.excluded_from_payroll, active: emp.active });
    await reload();
  };
  const add = async () => {
    if (!addId) return;
    const emp = (employees as EmpRow[]).find(e => e.id === Number(addId));
    if (!emp) return;
    await updateFlag({ id: emp.id, is_grace_list: true, is_macbook_swap: emp.is_macbook_swap, excluded_from_payroll: emp.excluded_from_payroll, active: emp.active });
    setAddId('');
    await reload();
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-6 h-6" /><h2 className="text-xl font-bold">Grace List</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Employees on this list receive a 10-minute tardiness grace period before being flagged.
      </p>
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">Add Employee to Grace List</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <select className="border rounded px-2 py-1.5 text-sm flex-1"
              value={addId} onChange={e => setAddId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Select employee —</option>
              {nonGrace.map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}
            </select>
            <Button size="sm" onClick={add} disabled={!addId}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
        </CardContent>
      </Card>
      <div className="rounded-lg border">
        {graceList.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No employees on grace list.</p>}
        {graceList.map(emp => (
          <div key={emp.id} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 hover:bg-slate-50">
            <span className="text-sm font-medium">{emp.display_name}</span>
            <Button size="sm" variant="outline" className="text-xs h-6 px-2 text-red-600" onClick={() => remove(emp)}>
              <X className="w-3 h-3 mr-1" />Remove
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
