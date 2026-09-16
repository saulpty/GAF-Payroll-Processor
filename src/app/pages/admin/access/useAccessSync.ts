import { useCallback } from 'react';
import { useMutateAction } from '@uibakery/data';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import loadMondaySyncLogAction from '@/actions/loadMondaySyncLog';
import upsertMondaySyncLogAction from '@/actions/upsertMondaySyncLog';
import loadAppUsersAction from '@/actions/loadAppUsers';
import loadAccessGroupsAction from '@/actions/loadAccessGroups';
import loadAccessGroupMembersAction from '@/actions/loadAccessGroupMembers';
import upsertAppUserAction from '@/actions/upsertAppUser';
import upsertAccessGroupAction from '@/actions/upsertAccessGroup';
import deleteAccessGroupAction from '@/actions/deleteAccessGroup';
import upsertAccessGroupManagerAction from '@/actions/upsertAccessGroupManager';
import upsertAccessGroupMemberAction from '@/actions/upsertAccessGroupMember';
import deleteAccessGroupMemberAction from '@/actions/deleteAccessGroupMember';
import { buildResolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';
import { syncAccessFromMonday, rowsOf } from './syncAccessFromMonday';
import type { AccessSyncResult } from './syncAccessFromMonday';

/** Access groups follow Monday on their own: at most once per this many minutes, on app open. */
export const ACCESS_SYNC_EVERY_MINUTES = 30;
export const ACCESS_SYNC_LOG_KEY = 'access_groups';

type ResolverEmps = Parameters<typeof buildResolver>[0];
type ResolverAliases = Parameters<typeof buildResolver>[1];

let inFlight: Promise<AccessSyncResult | null> | null = null;

/** Returns sync(force). force=false skips when the last run is newer than ACCESS_SYNC_EVERY_MINUTES. */
export function useAccessSync() {
  const [pull]          = useMutateAction(pullMondayBoardAction);
  const [fetchConfig]   = useMutateAction(loadClassificationConfigAction);
  const [fetchEmps]     = useMutateAction(loadAllEmployeesAction);
  const [fetchAliases]  = useMutateAction(loadNameAliasesAction);
  const [fetchLog]      = useMutateAction(loadMondaySyncLogAction);
  const [writeLog]      = useMutateAction(upsertMondaySyncLogAction);
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
  const [upsertUser]    = useMutateAction(upsertAppUserAction);
  const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
  const [deleteGroup]   = useMutateAction(deleteAccessGroupAction);
  const [upsertManager] = useMutateAction(upsertAccessGroupManagerAction);
  const [upsertMember]  = useMutateAction(upsertAccessGroupMemberAction);
  const [deleteMember]  = useMutateAction(deleteAccessGroupMemberAction);

  return useCallback((force: boolean): Promise<AccessSyncResult | null> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      if (!force) {
        const last = rowsOf(await fetchLog({})).find(r => r.board_key === ACCESS_SYNC_LOG_KEY);
        const at = last?.last_synced_at ? Date.parse(String(last.last_synced_at)) : NaN;
        if (!Number.isNaN(at) && Date.now() - at < ACCESS_SYNC_EVERY_MINUTES * 60_000) return null;
      }
      const [cfgRows, empRows, aliasRows] = await Promise.all([fetchConfig({}), fetchEmps({}), fetchAliases({})]);
      const cfg = Object.fromEntries(rowsOf(cfgRows).map(r => [String(r.key), String(r.value ?? '')]));
      const employees = rowsOf(empRows);
      const resolve = buildResolver(employees as unknown as ResolverEmps, rowsOf(aliasRows) as unknown as ResolverAliases, normalizeName);
      try {
        const r = await syncAccessFromMonday({
          cfg, pull: p => pull(p), resolve, employees,
          fetchUsers: () => fetchUsers({}), fetchGroups: () => fetchGroups({}), fetchMembers: () => fetchMembers({}),
          upsertUser, upsertGroup, deleteGroup, upsertManager, upsertMember, deleteMember,
        });
        await writeLog({ board_key: ACCESS_SYNC_LOG_KEY, item_count: r.placed, matched_count: r.changes,
          unmatched_count: r.skipped.length, last_error: null });
        return r;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await writeLog({ board_key: ACCESS_SYNC_LOG_KEY, item_count: 0, matched_count: 0, unmatched_count: 0, last_error: msg })
          .catch(() => undefined);
        throw e;
      }
    })().finally(() => { inFlight = null; });
    return inFlight;
  }, [pull, fetchConfig, fetchEmps, fetchAliases, fetchLog, writeLog, fetchUsers, fetchGroups, fetchMembers,
      upsertUser, upsertGroup, deleteGroup, upsertManager, upsertMember, deleteMember]);
}
