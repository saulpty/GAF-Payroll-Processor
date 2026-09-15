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
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
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
    if (!window.confirm("Read the Panama Employee Directory and add any missing manager users, one group per manager email, and each current employee to their manager's group? Nothing that already exists is changed or removed.")) return;
    setRunning(true); setError(null); setResult(null); setShowSkipped(false);
    try {
      const r = await seedFromMonday({
        cfg, pull: p => callMondayBoard(p), resolve: resolver, mode: 'seed',
        fetchUsers: () => fetchUsers({}), fetchGroups: () => fetchGroups({}), fetchMembers: () => fetchMembers({}),
        upsertUser, upsertGroup, upsertManager, upsertMember,
      });
      setResult(r);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" onClick={run} disabled={running}>
        {running
          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Reading Monday…</>
          : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Build from Monday</>}
      </Button>
      {result && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          <div className="flex items-start justify-between gap-3">
            <span>
              {result.usersAdded} manager users added · {result.groupsAdded} groups created · {result.membersAdded} employees placed · {result.alreadyGrouped} already in a group
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
