import { useCallback, useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import loadTeramindAgentDirectoryAction from '@/actions/loadTeramindAgentDirectory';
import loadTeramindAgentsAction from '@/actions/loadTeramindAgents';
import loadTeramindTimeRecordsAction from '@/actions/loadTeramindTimeRecords';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
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
  const { viewAs, email: viewerEmail } = useViewer();
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [fetchDirectory]      = useMutateAction(loadTeramindAgentDirectoryAction);
  const [fetchSavedAgents]    = useMutateAction(loadTeramindAgentsAction);
  const [fetchTimeRecords]    = useMutateAction(loadTeramindTimeRecordsAction);
  const [fetchEmployees]      = useMutateAction(loadAttendanceEmployeesAction);
  const [upsertAgents]        = useMutateAction(upsertTeramindAgentsAction);
  const [linkAgentsAction]    = useMutateAction(updateTeramindAgentLinksAction);
  const [upsertSessions]      = useMutateAction(upsertTeramindSessionsAction);
  const [upsertPullLog]       = useMutateAction(upsertTeramindPullLogAction);

  const syncAgents = useCallback(async (): Promise<SyncAgentsResult> => {
    setSyncing(true);
    setError(null);
    try {
      const dirResp = await fetchDirectory({});
      const dirRows = unwrapRows(dirResp);
      const allAgents: TeramindAgent[] = dirRows
        .map(r => normalizeAgent(r))
        .filter((a): a is TeramindAgent => a !== null);

      const savedResp = await fetchSavedAgents({});
      const savedRows = rowsOf(savedResp);
      const linkedIds = new Set<number>(
        savedRows
          .filter(r => r.employee_id != null)
          .map(r => Number(r.agent_id))
      );

      const keptAgents = allAgents.filter(a => !a.deleted || linkedIds.has(a.agent_id));

      for (const chunk of chunkArray(keptAgents, 200)) {
        const rows = chunk.map((a) => ({
          agent_id: a.agent_id,
          email: a.email,
          name: a.name,
          deleted: a.deleted,
          raw: dirRows[allAgents.indexOf(a)] ?? a,
        }));
        await upsertAgents({ rows: JSON.stringify(rows) });
      }

      const empResp = await fetchEmployees({ viewAs });
      const employees = rowsOf(empResp).map(e => ({
        id: Number(e.id),
        teramind_email: String(e.email ?? ''),
      }));

      const { links, unlinkedEmployees } = linkAgents(keptAgents, employees);

      if (links.length > 0) {
        await linkAgentsAction({ rows: JSON.stringify(links), linked_by: 'auto' });
      }

      return { agents: keptAgents.length, linked: links.length, unlinked: unlinkedEmployees.length };
    } finally {
      setSyncing(false);
    }
  }, [fetchDirectory, fetchSavedAgents, upsertAgents, fetchEmployees, viewAs, linkAgentsAction]);

  const pullRange = useCallback(async (
    from: string,
    to: string,
    trigger: 'manual' | 'backfill',
  ): Promise<PullRangeResult> => {
    setPulling(true);
    setError(null);

    // 1. Linked agent ids
    const savedResp = await fetchSavedAgents({});
    const savedRows = rowsOf(savedResp);
    const linkedAgentSet = new Set<number>(
      savedRows
        .filter(r => r.employee_id != null)
        .map(r => Number(r.agent_id))
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
      // 2. Build the epoch-second window (one day wider each side)
      const { periodStart, periodEnd } = recordWindow(from, to);

      // 3. Page loop — up to 40 pages of 5000
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

        // Stop if the API signals no next page or returned nothing
        const pagination = (resp as Record<string, unknown>)?.pagination;
        const hasNext = (pagination as Record<string, unknown>)?.next === true;
        if (!hasNext || rawRows.length === 0) break;

        if (page === MAX_PAGES - 1) {
          truncated = true;
        }
      }

      // 4. Save in chunks of 200
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

      // 5. Write pull log
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
