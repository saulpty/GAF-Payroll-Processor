import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Loader2, Plus, X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadAccessGroupsAction from '@/actions/loadAccessGroups';
import loadAccessGroupMembersAction from '@/actions/loadAccessGroupMembers';
import loadUnassignedEmployeesAction from '@/actions/loadUnassignedEmployees';
import loadAppUsersAction from '@/actions/loadAppUsers';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import upsertAccessGroupAction from '@/actions/upsertAccessGroup';
import deleteAccessGroupAction from '@/actions/deleteAccessGroup';
import upsertAccessGroupMemberAction from '@/actions/upsertAccessGroupMember';
import deleteAccessGroupMemberAction from '@/actions/deleteAccessGroupMember';
import upsertAccessGroupManagerAction from '@/actions/upsertAccessGroupManager';
import deleteAccessGroupManagerAction from '@/actions/deleteAccessGroupManager';
import GroupCard from '@/app/pages/admin/access/GroupCard';
import type { GroupRow, MemberRow, ManagerOption, EmployeeOption } from '@/app/pages/admin/access/GroupCard';

type UnassignedRow = { employee_id: number | string; display_name: string; teramind_email: string; monday_manager: string };
type UserRow = { id: number | string; display_name: string; email: string; role: string; all_employees: boolean; active: boolean };
type EmpRow  = { id: number | string; display_name: string; active: boolean };

function parseManagers(raw: unknown): GroupRow['managers'] {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  if (Array.isArray(raw)) return raw as GroupRow['managers'];
  return [];
}

export default function GroupsTab() {
  const [groups,     gLoading, gError, reloadGroups]     = useLoadAction(loadAccessGroupsAction,        [] as GroupRow[]);
  const [members,    ,         ,       reloadMembers]    = useLoadAction(loadAccessGroupMembersAction,  [] as MemberRow[]);
  const [unassigned, ,         ,       reloadUnassigned] = useLoadAction(loadUnassignedEmployeesAction, [] as UnassignedRow[]);
  const [users,      ,         ,       reloadUsers]      = useLoadAction(loadAppUsersAction,            [] as UserRow[]);
  const [allEmps]                                        = useLoadAction(loadAllEmployeesAction,        [] as EmpRow[]);

  const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
  const [deleteGroup]   = useMutateAction(deleteAccessGroupAction);
  const [addMember]     = useMutateAction(upsertAccessGroupMemberAction);
  const [removeMember]  = useMutateAction(deleteAccessGroupMemberAction);
  const [setManager]    = useMutateAction(upsertAccessGroupManagerAction);
  const [removeManager] = useMutateAction(deleteAccessGroupManagerAction);

  const reloadAll = async () => {
    await Promise.all([reloadGroups(), reloadMembers(), reloadUnassigned(), reloadUsers()]);
  };

  const [search, setSearch]         = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addGroupBusy, setAddGroupBusy] = useState(false);
  const [addGroupErr, setAddGroupErr]   = useState('');
  const [unassignedOpen, setUnassignedOpen] = useState(true);

  const groupList  = groups     as GroupRow[];
  const memberList = members    as MemberRow[];
  const unassList  = unassigned as UnassignedRow[];
  const userList   = users      as UserRow[];
  const empList    = allEmps    as EmpRow[];

  // Normalise managers field
  const normalisedGroups = useMemo(() =>
    groupList.map(g => ({ ...g, managers: parseManagers(g.managers) })),
    [groupList]
  );

  const managerOptions: ManagerOption[] = useMemo(() =>
    userList.filter(u => u.role === 'manager' && u.active).map(u => ({ id: u.id, display_name: u.display_name, email: u.email })),
    [userList]
  );

  const employeeOptions: EmployeeOption[] = useMemo(() =>
    (empList as EmpRow[]).filter(e => e.active).map(e => ({ id: e.id, display_name: e.display_name, active: e.active })),
    [empList]
  );

  const assignedCount = useMemo(() => {
    const ids = new Set(memberList.map(m => String(m.employee_id)));
    return ids.size;
  }, [memberList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return normalisedGroups;
    return normalisedGroups.filter(g => {
      if (g.name.toLowerCase().includes(q)) return true;
      if (g.managers.some(m => m.display_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))) return true;
      const mems = memberList.filter(m => String(m.group_id) === String(g.id));
      if (mems.some(m => m.display_name.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [normalisedGroups, memberList, search]);

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setAddGroupBusy(true);
    setAddGroupErr('');
    await upsertGroup({ id: null, name, notes: null });
    await reloadAll();
    const exists = (groups as GroupRow[]).find(g => g.name.toLowerCase() === name.toLowerCase());
    if (!exists) setAddGroupErr('A group with that name already exists.');
    else { setAddingGroup(false); setNewGroupName(''); }
    setAddGroupBusy(false);
  };

  const makeHandlers = (group: GroupRow) => ({
    onRename: async (name: string) => { await upsertGroup({ id: group.id, name, notes: group.notes || null }); await reloadAll(); },
    onDelete: async () => { await deleteGroup({ id: group.id }); await reloadAll(); },
    onSetManager: async (userId: number | string, rank: number) => { await setManager({ group_id: group.id, user_id: userId, rank }); await reloadAll(); },
    onRemoveManager: async (userId: number | string) => { await removeManager({ group_id: group.id, user_id: userId }); await reloadAll(); },
    onAddMember: async (employeeId: number | string) => { await addMember({ group_id: group.id, employee_id: employeeId }); await reloadAll(); },
    onRemoveMember: async (employeeId: number | string) => { await removeMember({ group_id: group.id, employee_id: employeeId }); await reloadAll(); },
  });

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            className="w-full border rounded-md pl-8 pr-8 py-2 text-sm bg-white"
            placeholder="Search groups, managers, members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {normalisedGroups.length} groups · {assignedCount} employees in groups · {unassList.length} not in any group
        </span>
        {!addingGroup && (
          <Button size="sm" onClick={() => { setAddingGroup(true); setAddGroupErr(''); setNewGroupName(''); }}>
            <Plus className="w-4 h-4 mr-1.5" />Add group
          </Button>
        )}
        {addingGroup && (
          <form className="flex items-center gap-1.5" onSubmit={e => { e.preventDefault(); handleAddGroup(); }}>
            <input
              autoFocus
              className="border rounded px-2 py-1.5 text-sm w-44"
              placeholder="Group name"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
            />
            <Button size="sm" type="submit" disabled={addGroupBusy}>
              {addGroupBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => { setAddingGroup(false); setAddGroupErr(''); }}>Cancel</Button>
          </form>
        )}
      </div>
      {addGroupErr && <p className="text-red-500 text-sm mb-3">{addGroupErr}</p>}

      {/* Unassigned card */}
      {unassList.length > 0 && (
        <div className="mb-4 border border-amber-300 bg-amber-50 rounded-xl p-4">
          <button
            className="flex items-center gap-2 w-full text-left mb-2"
            onClick={() => setUnassignedOpen(v => !v)}
          >
            {unassignedOpen ? <ChevronDown className="w-4 h-4 text-amber-600 shrink-0" /> : <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />}
            <span className="text-sm font-semibold text-amber-800">
              Active employees in no group ({unassList.length}) — no manager can see them
            </span>
          </button>
          {unassignedOpen && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {unassList.map(e => (
                <span key={String(e.employee_id)} className="inline-flex items-center gap-1 bg-white border border-amber-200 rounded-full px-2.5 py-0.5 text-xs">
                  <span className="text-slate-800 font-medium">{e.display_name}</span>
                  {e.monday_manager && <span className="text-slate-400">{e.monday_manager}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading / error */}
      {gLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}
      {gError && !gLoading && (
        <div className="text-red-500 text-sm flex items-center gap-3 py-6">
          Failed to load groups.
          <Button size="sm" variant="outline" onClick={reloadAll}>Retry</Button>
        </div>
      )}

      {/* Groups grid */}
      {!gLoading && !gError && (
        filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-6">
            {normalisedGroups.length === 0
              ? 'No groups yet. Add one, or build them from Monday (coming next).'
              : 'No groups match your search.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(group => (
              <GroupCard
                key={String(group.id)}
                group={group}
                members={memberList.filter(m => String(m.group_id) === String(group.id))}
                managerOptions={managerOptions}
                employeeOptions={employeeOptions}
                {...makeHandlers(group)}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
