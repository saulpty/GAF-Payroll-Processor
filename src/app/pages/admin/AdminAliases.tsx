import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import loadNameAliasesAdminAction from '@/actions/loadNameAliasesAdmin';
import deleteNameAliasAction from '@/actions/deleteNameAlias';
import saveNameAliasAction from '@/actions/saveNameAlias';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';

type AliasRow = { id: number; alias_text: string; employee_id: number; employee_name: string };
type EmpRow = { id: number; display_name: string };

export default function AdminAliases() {
  const [aliases, , , reload] = useLoadAction(loadNameAliasesAdminAction, [] as AliasRow[]);
  const [employees] = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);
  const [deleteAlias] = useMutateAction(deleteNameAliasAction);
  const [saveAlias] = useMutateAction(saveNameAliasAction);

  const [newAlias, setNewAlias] = useState('');
  const [newEmpId, setNewEmpId] = useState<number | ''>('');

  const handleAdd = async () => {
    if (!newAlias.trim() || !newEmpId) return;
    await saveAlias({ aliasText: newAlias.trim(), employeeId: Number(newEmpId) });
    setNewAlias(''); setNewEmpId('');
    await reload();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this alias?')) return;
    await deleteAlias({ id });
    await reload();
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-6 h-6" /><h2 className="text-xl font-bold">Name Aliases</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Maps variant name spellings from Monday.com boards to canonical employees. Matching is case- and accent-insensitive.
      </p>
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">Add Alias</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input className="border rounded px-2 py-1.5 text-sm flex-1" placeholder="Alias text (e.g. Ozzy Medina)"
              value={newAlias} onChange={e => setNewAlias(e.target.value)} />
            <select className="border rounded px-2 py-1.5 text-sm flex-1"
              value={newEmpId} onChange={e => setNewEmpId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">→ Employee</option>
              {(employees as EmpRow[]).map(e => <option key={e.id} value={e.id}>{e.display_name}</option>)}
            </select>
            <Button size="sm" onClick={handleAdd} disabled={!newAlias.trim() || !newEmpId}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
        </CardContent>
      </Card>
      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left border-b border-r font-semibold">Alias Text</th>
              <th className="px-3 py-2 text-left border-b border-r font-semibold">→ Employee</th>
              <th className="px-3 py-2 border-b w-10" />
            </tr>
          </thead>
          <tbody>
            {(aliases as AliasRow[]).map(a => (
              <tr key={a.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2 border-r font-mono text-xs">{a.alias_text}</td>
                <td className="px-3 py-2 border-r">{a.employee_name}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(aliases as AliasRow[]).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No aliases defined.</p>}
      </div>
    </div>
  );
}
