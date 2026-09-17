import { useCallback, useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import loadTeramindAgentDirectoryAction from '@/actions/loadTeramindAgentDirectory';
import loadTeramindAgentsAction from '@/actions/loadTeramindAgents';
import loadTeramindTimeRecordsAction from '@/actions/loadTeramindTimeRecords';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import upsertTeramindAgentsAction from '@/actions/upsertTeramindAgents';
import updateTeramindAgentLinksAction from '@/actions/updateTeramindAgentLinks';
import upsertTeramindSessionsAction from '@/actions/upsertTeramindSessions';
import upsertTeramindPullLogAction from '@/actions/upsertTeramindPullLog';
import { unwrapRows, normalizeAgent, linkAgents, normalizeTimeRecord } from '@/app/lib/teramindRows';
import { sessionClock } from '@/app/lib/teramindTime';
import { recordWindow, inDateRange } from '@/app/lib/teramindPull';
import type { TeramindAgent, TeramindSessionSave } from '@/app/lib/teramindTypes';

function rowsOf(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  return [];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export type SyncAgentsResult = { agents: number; linked: number; unlinked: number };
export type PullRangeResult  = { fetched: number; saved: number; dropped: number; truncated: boolean };

export function useTeramindPull() {
  const { viewAs: _viewAs, email: viewerEmail } = useViewer();
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [fetchDirectory]   = useMutateAction(loadTeramindAgentDirectoryAction);
  const [fetchSavedAgents] = useMutateAction(loadTeramindAgentsAction);
  const [fetchTimeRecords] = useMutateAction(loadTeramindTimeRecordsAction);
  const [fetchAllEmployees]= useMutateAction(loadAllEmployeesAction);
  const [upsertAgents]     = useMutateAction(upsertTeramindAgentsAction);
  const [linkAgentsAction] = useMutateAction(updateTeramindAgentLinksAction);
  const [upsertSessions]   = useMutateAction(upsertTeramindSessionsAction);
  const [upsertPullLog]    = useMutateAction(upsertTeramindPullLogAction);

  const syncAgents = useCallback(async (): Promise<SyncAgentsResult> => {
    setSyncing(true);
    setError(null);
    try {
      // 1. Fetch full Teramind roster (all agents, deleted included)
      const dirResp = await fetchDirectory({});
      const dirRows = unwrapRows(dirResp);
      const allAgents: TeramindAgent[] = dirRows
        .map(r => normalizeAgent(r))
        .filter((a): a is TeramindAgent => a !== null);

      // 2. Load already-saved agents to know which are already linked
      const savedResp = await fetchSavedAgents({});
      const savedRows = rowsOf(savedResp);
      const prevLinkedIds = new Set<number>(
        savedRows.filter(r => r.employee_id != null).map(r => Number(r.agent_id))
      );

      // 3. Load ALL employees (active + former), skip those with no teramind_email
      const empResp = await fetchAllEmployees({});
      const allEmpRows = rowsOf(empResp);
      const employees = allEmpRows
        .filter(e => typeof e.teramind_email === 'string' && String(e.teramind_email).trim() !== '')
        .map(e => ({
          id: Number(e.id),
          teramind_email: String(e.teramind_email).trim(),
          active: e.active === true || e.active === 'true' || e.active === 1,
        }));

      // 4. Link ALL agents (deleted included) against ALL employees (former included)
      const { links, unlinkedEmployees } = linkAgents(allAgents, employees);
      const linkedByThisRun = new Set(links.map(l => l.agent_id));

      // 5. Keep agent when: not deleted, OR already linked, OR newly linked by this run
      const keptAgents = allAgents.filter(
        a => !a.deleted || prevLinkedIds.has(a.agent_id) || linkedByThisRun.has(a.agent_id)
      );

      // 6. Upsert kept agents in chunks of 200
      for (const chunk of chunkArray(keptAgents, 200)) {
        const rows = chunk.map(a => ({
          agent_id: a.agent_id,
          email:    a.email,
          name:     a.name,
          deleted:  a.deleted,
          raw:      dirRows[allAgents.indexOf(a)] ?? a,
        }));
        await upsertAgents({ rows: JSON.stringify(rows) });
      }

      // 7. Bulk-update links
      if (links.length > 0) {
        await linkAgentsAction({ rows: JSON.stringify(links), linked_by: 'auto' });
      }

      // 8. unlinked = active employees with no agent
      const linkedEmpIds = new Set(links.map(l => l.employee_id));
      const unlinkedActive = employees.filter(e => e.active && !linkedEmpIds.has(e.id));

      return { agents: keptAgents.length, linked: links.length, unlinked: unlinkedActive.length };
    } finally {
      setSyncing(false);
    }
  }, [fetchDirectory, fetchSavedAgents, fetchAllEmployees, upsertAgents, linkAgentsAction]);

  const pullRange = useCallback(async (
    from: string,
    to: string,
    trigger: 'manual' | 'backfill',
  ): Promise<PullRangeResult> => {
    setPulling(true);
    setError(null);

    // Linked agent ids from saved roster
    const savedResp = await fetchSavedAgents({});
    const savedRows = rowsOf(savedResp);
    const linkedAgentSet = new Set<number>(
      savedRows.filter(r => r.employee_id != null).map(r => Number(r.agent_id))
    );
    const agentIds = [...linkedAgentSet];
    if (agentIds.length === 0) {
      setPulling(false);
      throw new Error('Sync the roster and link at least one employee before pulling.');
    }

    let fetched = 0;
    let saved   = 0;
    let dropped = 0;
    let truncated = false;

    try {
      const { periodStart, periodEnd } = recordWindow(from, to);

      const PAGE_SIZE = 5000;
      const MAX_PAGES = 40;
      const allSessions: (TeramindSessionSave & { raw: unknown })[] = [];

      for (let page = 0; page < MAX_PAGES; page++) {
        const resp = await fetchTimeRecords({
          agents: agentIds,
          page,
          pageSize: PAGE_SIZE,
          periodStart,
          periodEnd,
        });

        const rawRows = unwrapRows(resp);
        fetched += rawRows.length;

        for (const row of rawRows) {
          const session = normalizeTimeRecord(row, sessionClock);
          if (session === null) { dropped++; continue; }
          if (!linkedAgentSet.has(session.agent_id)) { dropped++; continue; }
          if (!inDateRange(session.work_date, from, to)) { dropped++; continue; }
          allSessions.push({ ...session, raw: row });
        }

        const pagination = (resp as Record<string, unknown>)?.pagination;
        const hasNext = (pagination as Record<string, unknown>)?.next === true;
        if (!hasNext || rawRows.length === 0) break;
        if (page === MAX_PAGES - 1) truncated = true;
      }

      for (const batch of chunkArray(allSessions, 200)) {
        const rows = batch.map(s => ({
          agent_id:    s.agent_id,
          work_date:   s.work_date,
          started_et:  s.started_et,
          finished_et: s.finished_et,
          started_raw: s.started_raw,
          duration_s:  s.duration_s,
          computer:    s.computer,
          source:      'time_record',
          is_manual:   s.is_manual ?? false,
          raw:         s.raw,
        }));
        await upsertSessions({ rows: JSON.stringify(rows) });
        saved += rows.length;
      }

      await upsertPullLog({
        date_from:   from,
        date_to:     to,
        pulled_by:   viewerEmail,
        trigger,
        agent_count: agentIds.length,
        row_count:   fetched,
        saved_count: saved,
        truncated,
        error:       '',
        source:      'time_record',
      });

      return { fetched, saved, dropped, truncated };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await upsertPullLog({
        date_from:   from,
        date_to:     to,
        pulled_by:   viewerEmail,
        trigger,
        agent_count: agentIds.length,
        row_count:   fetched,
        saved_count: 0,
        truncated,
        error:       msg,
        source:      'time_record',
      }).catch(() => undefined);
      throw e;
    } finally {
      setPulling(false);
    }
  }, [fetchSavedAgents, fetchTimeRecords, upsertSessions, upsertPullLog, viewerEmail]);

  return { syncAgents, pullRange, syncing, pulling, error };
}
