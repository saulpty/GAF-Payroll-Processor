import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Plus, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import loadSchedulesAction from '@/actions/loadSchedules';
import upsertScheduleAction from '@/actions/upsertSchedule';

type Schedule = { id: number; schedule_name: string; dst_start: string; dst_end: string; standard_start: string; standard_end: string; grace_minutes: number; notes: string };
// Times are stored in US Eastern: dst_* = Summer (ET), standard_* = Winter (ET).
const EMPTY: Partial<Schedule> = { schedule_name: '', dst_start: '9:00 AM', dst_end: '5:00 PM', standard_start: '9:00 AM', standard_end: '5:00 PM', grace_minutes: 10, notes: '' };

export default function AdminSchedules() {
  const [schedules, , , reload] = useLoadAction(loadSchedulesAction, [] as Schedule[]);
  const [upsert, saving] = useMutateAction(upsertScheduleAction);
  const [editing, setEditing] = useState<Partial<Schedule> | null>(null);

  const handleSave = async () => {
    if (!editing) return;
    await upsert(editing);
    setEditing(null);
    await reload();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div></div>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Times are in <span className="font-medium">US Eastern</span>. Summer and Winter are the same for most
        people — set them differently only for teams that don't follow US daylight saving (e.g. Arizona).
      </p>

      {editing && (
        <Card className="mb-4 border-blue-300">
          <CardHeader><CardTitle className="text-sm">{editing.id ? 'Edit Schedule' : 'New Schedule'}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[['schedule_name','Name'],['dst_start','Summer Start (ET)'],['dst_end','Summer End (ET)'],['standard_start','Winter Start (ET)'],['standard_end','Winter End (ET)'],['notes','Notes']].map(([f, l]) => (
                <div key={f}>
                  <label className="text-xs font-medium block mb-1">{l}</label>
                  <input className="w-full border rounded px-2 py-1.5 text-sm"
                    value={(editing[f as keyof Schedule] as string) || ''}
                    onChange={e => setEditing(prev => ({ ...prev!, [f]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium block mb-1">Grace (min)</label>
                <input type="number" className="w-full border rounded px-2 py-1.5 text-sm"
                  value={editing.grace_minutes ?? 10}
                  onChange={e => setEditing(prev => ({ ...prev!, grace_minutes: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}><Save className="w-4 h-4 mr-1" />Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-slate-100">
            <tr>{['Name','Summer Start (ET)','Summer End (ET)','Winter Start (ET)','Winter End (ET)','Grace','Notes',''].map(h=><th key={h} className="px-3 py-2 text-left border-b border-r last:border-r-0 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {(schedules as Schedule[]).map(s => (
              <tr key={s.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2 border-r font-medium">{s.schedule_name}</td>
                <td className="px-3 py-2 border-r">{s.dst_start}</td>
                <td className="px-3 py-2 border-r">{s.dst_end}</td>
                <td className="px-3 py-2 border-r">{s.standard_start}</td>
                <td className="px-3 py-2 border-r">{s.standard_end}</td>
                <td className="px-3 py-2 border-r text-center">{s.grace_minutes}</td>
                <td className="px-3 py-2 border-r text-slate-500 text-xs">{s.notes}</td>
                <td className="px-3 py-2 text-center"><Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => setEditing({ ...s })}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
