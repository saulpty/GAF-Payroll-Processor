import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { normalizeEmail } from '@/app/lib/access';

export type UserRow = {
  id: number | string;
  email: string;
  display_name: string;
  role: 'super_user' | 'manager';
  all_employees: boolean;
  active: boolean;
  notes: string;
  group_count: number;
};

type Props = {
  editing: Partial<UserRow> | null;
  saving: boolean;
  onSave: (data: {
    id: number | string | null;
    email: string;
    display_name: string;
    role: string;
    all_employees: boolean;
    active: boolean;
    notes: string | null;
  }) => Promise<void>;
  onCancel: () => void;
};

export default function UserForm({ editing, saving, onSave, onCancel }: Props) {
  const [email, setEmail]           = useState(editing?.email ?? '');
  const [name, setName]             = useState(editing?.display_name ?? '');
  const [role, setRole]             = useState<'super_user' | 'manager'>(editing?.role ?? 'manager');
  const [allEmps, setAllEmps]       = useState(editing?.all_employees ?? false);
  const [active, setActive]         = useState(editing?.active ?? true);
  const [notes, setNotes]           = useState(editing?.notes ?? '');
  const [emailErr, setEmailErr]     = useState('');
  const [saveErr, setSaveErr]       = useState('');

  const handleSave = async () => {
    if (!email.includes('@')) { setEmailErr('Enter a valid email'); return; }
    setEmailErr('');
    setSaveErr('');
    try {
      await onSave({
        id: editing?.id ?? null,
        email: normalizeEmail(email),
        display_name: name.trim(),
        role,
        all_employees: role === 'super_user' ? false : allEmps,
        active,
        notes: notes.trim() || null,
      });
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <Card className="mb-5 border-blue-300 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          {editing?.id ? `Editing: ${editing.display_name || editing.email}` : 'New User'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium block mb-1 text-slate-600">Email *</label>
            <input
              className={`w-full border rounded px-2 py-1.5 text-sm ${emailErr ? 'border-red-400' : ''}`}
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailErr(''); }}
              placeholder="person@vitasyahc.com"
            />
            {emailErr && <p className="text-red-500 text-xs mt-0.5">{emailErr}</p>}
          </div>
          <div>
            <label className="text-xs font-medium block mb-1 text-slate-600">Name</label>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1 text-slate-600">Role</label>
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={role}
              onChange={e => setRole(e.target.value as 'super_user' | 'manager')}
            >
              <option value="super_user">Super user</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1 text-slate-600">Notes</label>
            <input
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-slate-50 rounded-lg border">
          <label className={`flex items-center gap-2 select-none ${role === 'super_user' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            title="Sees every employee, still no Payroll or Admin.">
            <input
              type="checkbox"
              className="w-3.5 h-3.5"
              checked={role === 'super_user' ? false : allEmps}
              disabled={role === 'super_user'}
              onChange={e => setAllEmps(e.target.checked)}
            />
            <span className="text-sm text-slate-700">All employees</span>
            <span className="text-xs text-slate-400">(Sees every employee, still no Payroll or Admin)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none"
            title="Inactive people see the No access screen.">
            <input
              type="checkbox"
              className="w-3.5 h-3.5"
              checked={active}
              onChange={e => setActive(e.target.checked)}
            />
            <span className="text-sm text-slate-700">Active</span>
            <span className="text-xs text-slate-400">(Inactive people see the No access screen)</span>
          </label>
        </div>

        {saveErr && <p className="text-red-500 text-sm mb-3">{saveErr}</p>}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
              : <Save className="w-4 h-4 mr-1" />}
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
