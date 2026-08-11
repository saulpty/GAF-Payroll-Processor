import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import loadHolidaysAdminAction from '@/actions/loadHolidaysAdmin';
import upsertHolidayAction from '@/actions/upsertHoliday';
import deleteHolidayAction from '@/actions/deleteHoliday';

type Holiday = { id: number; date: string; name: string };

export default function AdminHolidays() {
  const [holidays, , , reload] = useLoadAction(loadHolidaysAdminAction, [] as Holiday[]);
  const [upsert] = useMutateAction(upsertHolidayAction);
  const [del] = useMutateAction(deleteHolidayAction);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    if (!newDate || !newName) return;
    await upsert({ date: newDate, name: newName });
    setNewDate(''); setNewName('');
    await reload();
  };

  return (
    <div className="p-6">

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">Add Holiday</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input type="date" className="border rounded px-2 py-1.5 text-sm" value={newDate} onChange={e => setNewDate(e.target.value)} />
            <input className="border rounded px-2 py-1.5 text-sm flex-1" placeholder="Holiday name" value={newName} onChange={e => setNewName(e.target.value)} />
            <Button size="sm" onClick={handleAdd} disabled={!newDate || !newName}><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
        </CardContent>
      </Card>
      <div className="rounded-lg border">
        {(holidays as Holiday[]).map(h => (
          <div key={h.id} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 hover:bg-slate-50">
            <span className="font-mono text-sm">{h.date}</span>
            <span className="text-sm flex-1 ml-4">{h.name}</span>
            <button onClick={async () => { if (window.confirm('Delete?')) { await del({ id: h.id }); await reload(); } }} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
