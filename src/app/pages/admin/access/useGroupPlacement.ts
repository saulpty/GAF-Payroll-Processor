import { useCallback } from 'react';
import { useMutateAction } from '@uibakery/data';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadAppUsersAction from '@/actions/loadAppUsers';
import loadAccessGroupsAction from '@/actions/loadAccessGroups';
import loadAccessGroupMembersAction from '@/actions/loadAccessGroupMembers';
import upsertAppUserAction from '@/actions/upsertAppUser';
import upsertAccessGroupAction from '@/actions/upsertAccessGroup';
import upsertAccessGroupManagerAction from '@/actions/upsertAccessGroupManager';
import upsertAccessGroupMemberAction from '@/actions/upsertAccessGroupMember';
import { seedFromMonday } from './seedFromMonday';
import type { SeedResult } from './seedFromMonday';

export function useGroupPlacement() {
  const [pull]          = useMutateAction(pullMondayBoardAction);
  const [fetchEmps]     = useMutateAction(loadAllEmployeesAction);
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
  const [upsertUser]    = useMutateAction(upsertAppUserAction);
  const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
  const [upsertManager] = useMutateAction(upsertAccessGroupManagerAction);
  const [upsertMember]  = useMutateAction(upsertAccessGroupMemberAction);

  return useCallback(async (
    cfg: Record<string, string>,
    resolve: (name: string | null | undefined, email: string | null | undefined) => number | null,
  ): Promise<SeedResult | null> => {
    if (!cfg.monday_col_directory_manager_email || !cfg.monday_col_directory_manager4_email) return null;
    return seedFromMonday({
      cfg, resolve, mode: 'newOnly',
      pull: p => pull(p),
      fetchEmployees: () => fetchEmps({}),
      fetchUsers: () => fetchUsers({}),
      fetchGroups: () => fetchGroups({}),
      fetchMembers: () => fetchMembers({}),
      upsertUser, upsertGroup, upsertManager, upsertMember,
    });
  }, [pull, fetchEmps, fetchUsers, fetchGroups, fetchMembers, upsertUser, upsertGroup, upsertManager, upsertMember]);
}
