import { useState } from 'react';
import { Pencil, Trash2, X, Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Manager = { user_id: number | string; email: string; display_name: string; rank: number };

export type GroupRow = {
  id: number | string;
  name: string;
  notes: string;
  member_count: number;
  managers: Manager[];
};

export type MemberRow = {
  group_id: number | string;
  employee_id: number | string;
  display_name: string;
  teramind_email: string;
  active: boolean;
  monday_manager: string;
};

export type ManagerOption = { id: number | string; display_name: string; email: string };
export type EmployeeOption = { id: number | string; display_name: string; active: boolean };

const RANK_LABELS: Record<number, string> = { 1: 'Primary', 2: 'Secondary', 3: 'Tertiary' };
function rankLabel(r: number) { return RANK_LABELS[r] ?? `#${r}`; }

type Props = {
  group: GroupRow;
  members: MemberRow[];
  managerOptions: ManagerOption[];
  employeeOptions: EmployeeOption[];
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetManager: (userId: number | string, rank: number) => Promise<void>;
  onRemoveManager: (userId: number | string) => Promise<void>;
  onAddMember: (employeeId: number | string) => Promise<void>;
  onRemoveMember: (employeeId: number | string) => Promise<void>;
};

export default function GroupCard({ group, members, managerOptions, employeeOptions, onRename, onDelete, onSetManager, onRemoveManager, onAddMember, onRemoveMember }: Props) {
  const [renaming, setRenaming]         = useState(false);
  const [nameVal, setNameVal]           = useState(group.name);
  const [renaming_,]                    = useState(false); void renaming_;
  const [busy, setBusy]                 = useState<string | null>(null);
  const [showAll, setShowAll]           = useState(false);
  const [selManager, setSelManager]     = useState('');
  const [selEmployee, setSelEmployee]   = useState('');

  const managers = [...group.managers].sort((a, b) => a.rank - b.rank);
  const membersSorted = [...members].sort((a, b) => a.display_name.localeCompare(b.display_name));
  const visibleMembers = showAll ? membersSorted : membersSorted.slice(0, 8);

  const existingManagerIds = new Set(managers.map(m => String(m.user_id)));
  const existingMemberIds  = new Set(members.map(m => String(m.employee_id)));
  const availableManagers  = managerOptions.filter(u => !existingManagerIds.has(String(u.id)));
  const availableEmployees = employeeOptions.filter(e => !existingMemberIds.has(String(e.id)));
  const maxRank = managers.length > 0 ? Math.max(...managers.map(m => m.rank)) : 0;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); try { await fn(); } finally { setBusy(null); }
  };

  const handleRenameSubmit = () => run('rename', async () => { await onRename(nameVal.trim()); setRenaming(false); });
  const handleDelete = () => {
    if (!window.confirm(`Delete group "${group.name}"? Its managers stop seeing these ${members.length} employees. No employee or user is deleted.`)) return;
    run('delete', onDelete);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        {renaming ? (
          <form className="flex items-center gap-1.5 flex-1" onSubmit={e => { e.preventDefault(); handleRenameSubmit(); }}>
            <input
              autoFocus
              className="flex-1 border rounded px-2 py-1 text-sm"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setRenaming(false); setNameVal(group.name); } }}
            />
            <Button size="sm" type="submit" disabled={busy === 'rename'}>
              {busy === 'rename' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => { setRenaming(false); setNameVal(group.name); }}>Cancel</Button>
          </form>
        ) : (
          <>
            <span className="font-semibold text-slate-800 text-sm flex-1 truncate">{group.name}</span>
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">{members.length} employees</span>
            <button title="Rename" onClick={() => setRenaming(true)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button title="Delete group" onClick={handleDelete} disabled={busy === 'delete'} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
              {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* Managers */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Managers</p>
          {managers.length === 0 && (
            <p className="text-xs text-amber-600 mb-2">No manager — only super users see this group.</p>
          )}
          {managers.map(m => (
            <div key={String(m.user_id)} className="flex items-center gap-2 py-1 text-xs">
              <span className="w-20 shrink-0 text-slate-500">{rankLabel(m.rank)}</span>
              <span className="font-medium text-slate-800 truncate">{m.display_name}</span>
              <span className="text-slate-400 truncate flex-1">{m.email}</span>
              <select
                className="border rounded px-1 py-0.5 text-xs"
                value={m.rank}
                disabled={!!busy}
                onChange={e => run(`mgr-rank-${m.user_id}`, () => onSetManager(m.user_id, Number(e.target.value)))}
              >
                {[1,2,3,4,5].map(r => <option key={r} value={r}>{rankLabel(r)}</option>)}
              </select>
              <button title="Remove manager" disabled={!!busy} onClick={() => run(`mgr-rm-${m.user_id}`, () => onRemoveManager(m.user_id))} className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                {busy === `mgr-rm-${m.user_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </div>
          ))}
          {/* Add manager */}
          {availableManagers.length === 0 && managers.length === 0 && (
            <p className="text-xs text-slate-400">Add managers on the Users tab first.</p>
          )}
          {availableManagers.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <select className="flex-1 border rounded px-1.5 py-1 text-xs" value={selManager} onChange={e => setSelManager(e.target.value)}>
                <option value="">— Select manager —</option>
                {availableManagers.map(u => <option key={String(u.id)} value={String(u.id)}>{u.display_name} — {u.email}</option>)}
              </select>
              <Button size="sm" variant="outline" disabled={!selManager || !!busy}
                onClick={() => { if (!selManager) return; run(`mgr-add-${selManager}`, async () => { await onSetManager(selManager, maxRank + 1); setSelManager(''); }); }}>
                <Plus className="w-3 h-3 mr-0.5" />Add
              </Button>
            </div>
          )}
        </div>

        {/* Employees */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Employees</p>
          {visibleMembers.map(m => (
            <div key={String(m.employee_id)} className="flex items-center gap-2 py-0.5 text-xs">
              <span className="flex-1 truncate text-slate-800">{m.display_name}</span>
              {!m.active && <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1">inactive</span>}
              <button title="Remove" disabled={!!busy} onClick={() => run(`emp-rm-${m.employee_id}`, () => onRemoveMember(m.employee_id))} className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                {busy === `emp-rm-${m.employee_id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </div>
          ))}
          {membersSorted.length > 8 && (
            <button onClick={() => setShowAll(v => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mt-1">
              {showAll ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {showAll ? 'Show fewer' : `Show all ${membersSorted.length}`}
            </button>
          )}
          {/* Add employee */}
          {availableEmployees.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <select className="flex-1 border rounded px-1.5 py-1 text-xs" value={selEmployee} onChange={e => setSelEmployee(e.target.value)}>
                <option value="">— Add employee —</option>
                {availableEmployees.map(e => <option key={String(e.id)} value={String(e.id)}>{e.display_name}</option>)}
              </select>
              <Button size="sm" variant="outline" disabled={!selEmployee || !!busy}
                onClick={() => { if (!selEmployee) return; run(`emp-add-${selEmployee}`, async () => { await onAddMember(selEmployee); setSelEmployee(''); }); }}>
                <Plus className="w-3 h-3 mr-0.5" />Add
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
