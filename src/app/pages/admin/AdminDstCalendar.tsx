import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Plus, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import loadDstCalendarAdminAction from '@/actions/loadDstCalendarAdmin';
import upsertDstCalendarAction from '@/actions/upsertDstCalendar';

type DstRow = { id: number; year: number; us_dst_start: string; us_dst_end: string };

export default function AdminDstCalendar() {
  const [rows, , , reload] = useLoadAction(loadDstCalendarAdminAction, [] as DstRow[]);
  const [upsert] = useMutateAction(upsertDstCalendarAction);
  const [editing, setEditing] = useState<Partial<DstRow> | null>(null);

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
        <Button size="sm" onClick={() => setEditing({ year: new Date().getFullYear(), us_dst_start: '', us_dst_end: '' })}><Plus className="w-4 h-4 mr-1" />Add Year</Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">US Daylight Saving Time windows used for Teramind timezone conversion (subtract 1 hr during DST).</p>

      {editing && (
        <Card className="mb-4 border-blue-300">
          <CardHeader><CardTitle className="text-sm">DST Entry</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 mb-3">
              <div><label className="text-xs font-medium block mb-1">Year</label>
                <input type="number" className="border rounded px-2 py-1.5 text-sm w-24" value={editing.year || ''} onChange={e => setEditing(p => ({ ...p!, year: Number(e.target.value) }))} /></div>
              <div><label className="text-xs font-medium block mb-1">DST Start</label>
                <input type="date" className="border rounded px-2 py-1.5 text-sm" value={editing.us_dst_start || ''} onChange={e => setEditing(p => ({ ...p!, us_dst_start: e.target.value }))} /></div>
              <div><label className="text-xs font-medium block mb-1">DST End</label>
                <input type="date" className="border rounded px-2 py-1.5 text-sm" value={editing.us_dst_end || ''} onChange={e => setEditing(p => ({ ...p!, us_dst_end: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" />Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border">
        {(rows as DstRow[]).map(r => (
          <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-slate-50">
            <span className="font-bold w-16">{r.year}</span>
            <span className="text-sm text-muted-foreground">DST Start: <span className="font-mono text-foreground">{r.us_dst_start?.slice(0,10)}</span></span>
            <span className="text-sm text-muted-foreground">DST End: <span className="font-mono text-foreground">{r.us_dst_end?.slice(0,10)}</span></span>
            <Button size="sm" variant="outline" className="text-xs h-6 px-2" onClick={() => setEditing({ ...r })}>Edit</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
