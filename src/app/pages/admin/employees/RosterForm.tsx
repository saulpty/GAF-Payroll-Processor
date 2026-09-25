import { Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FLAG_META, type EmpRow, type Schedule } from './rosterTypes';

/** The Roster's Edit / Add form (split out of RosterTab.tsx, 2026-09-25; unchanged markup). */
export function RosterForm({ editing, setEditing, emps, schedules, saveError, busy, onSave, onCancel }: {
  editing: Partial<EmpRow>;
  setEditing: (f: (prev: Partial<EmpRow> | null) => Partial<EmpRow> | null) => void;
  emps: EmpRow[];
  schedules: Schedule[];
  saveError: string | null;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
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
              {field === 'teramind_email' && typeof editing.id === 'number' &&
                (editing.teramind_email ?? '').trim().toLowerCase() !==
                (emps.find(e => e.id === editing.id)?.teramind_email ?? '').trim().toLowerCase() && (
                <p className="text-xs text-slate-400 mt-0.5">Changing the email keeps all history with this person.</p>
              )}
            </div>
          ))}
          <div>
            <label className="text-xs font-medium block mb-1 text-slate-600">Schedule</label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={editing.schedule_id || ''}
              onChange={e => setEditing(prev => ({ ...prev!, schedule_id: Number(e.target.value) }))}>
              <option value="">— Select schedule —</option>
              {schedules.map(s => (
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

        {saveError && <p className="text-red-700 text-xs mb-2">{saveError}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={busy}>
            {busy
              ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
              : <Save    className="w-4 h-4 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="outline"
            onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
