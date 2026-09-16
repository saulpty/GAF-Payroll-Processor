import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import loadAppUsersAction from '@/actions/loadAppUsers';
import loadAccessGroupsAction from '@/actions/loadAccessGroups';
import loadAccessGroupMembersAction from '@/actions/loadAccessGroupMembers';
import deleteAccessGroupAction from '@/actions/deleteAccessGroup';
import upsertAppUserAction from '@/actions/upsertAppUser';
import upsertAccessGroupAction from '@/actions/upsertAccessGroup';
import upsertAccessGroupManagerAction from '@/actions/upsertAccessGroupManager';
import upsertAccessGroupMemberAction from '@/actions/upsertAccessGroupMember';
import { buildResolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';
import { seedFromMonday } from './seedFromMonday';
import type { SeedResult } from './seedFromMonday';

type ResolverEmps = Parameters<typeof buildResolver>[0];
type ResolverAliases = Parameters<typeof buildResolver>[1];

export default function BuildFromMonday({ onDone }: { onDone: () => void | Promise<void> }) {
  const [configRaw]  = useLoadAction(loadClassificationConfigAction, [] as { key: string; value: string }[]);
  const [empsRaw]    = useLoadAction(loadAllEmployeesAction, []);
  const [aliasesRaw] = useLoadAction(loadNameAliasesAction, []);
  const [callMondayBoard] = useMutateAction(pullMondayBoardAction);
  const [fetchEmps]     = useMutateAction(loadAllEmployeesAction);
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
  const [deleteGroup]   = useMutateAction(deleteAccessGroupAction);
  const [upsertUser]    = useMutateAction(upsertAppUserAction);
  const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
  const [upsertManager] = useMutateAction(upsertAccessGroupManagerAction);
  const [upsertMember]  = useMutateAction(upsertAccessGroupMemberAction);

  const cfg = useMemo(
    () => Object.fromEntries((configRaw as { key: string; value: string }[]).map(r => [r.key, r.value])),
    [configRaw],
  );
  const resolver = useMemo(
    () => buildResolver(empsRaw as ResolverEmps, aliasesRaw as ResolverAliases, normalizeName),
    [empsRaw, aliasesRaw],
  );

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const run = async () => {
    if (!window.confirm(
      'Rebuild every access group from the Panama Employee Directory?\n\n' +
      'All current groups are deleted and rebuilt: one group per ordered manager list ' +
      '(Manager, Manager 2, Manager 3, Manager 4). Hand-made groups and hand-added managers are removed. ' +
      'Users are kept as they are; missing manager users are added.',
    )) return;
    setRunning(true); setError(null); setResult(null); setShowSkipped(false);
    try {
      const r = await seedFromMonday({
        cfg, pull: p => callMondayBoard(p), resolve: resolver, mode: 'rebuild',
        fetchEmployees: () => fetchEmps({}),
        fetchUsers: () => fetchUsers({}), fetchGroups: () => fetchGroups({}), fetchMembers: () => fetchMembers({}),
        deleteGroup, upsertUser, upsertGroup, upsertManager, upsertMember,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      await onDone();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" onClick={run} disabled={running}>
        {running
          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Rebuilding from Monday…</>
          : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Rebuild from Monday</>}
      </Button>
      {result && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          <div className="flex items-start justify-between gap-3">
            <span>
              {result.groupsRemoved} old groups removed · {result.groupsAdded} groups built · {result.usersAdded} manager users added · {result.membersAdded} employees placed
            </span>
            <button type="button" onClick={() => setResult(null)} title="Close" className="text-blue-700 hover:text-blue-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {result.skipped.length > 0 && (
            <div className="mt-1">
              <button type="button" onClick={() => setShowSkipped(s => !s)} className="underline underline-offset-2">
                {result.skipped.length} skipped
              </button>
              {showSkipped && (
                <ul className="mt-1 space-y-0.5">
                  {result.skipped.map((s, i) => <li key={i}>{s.name} — {s.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</div>
      )}
    </div>
  );
}
