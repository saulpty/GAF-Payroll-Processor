import { useCallback, useState } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import loadTeramindAgentDirectoryAction from '@/actions/loadTeramindAgentDirectory';
import loadTeramindAgentsAction from '@/actions/loadTeramindAgents';
import loadTeramindLoginSessionsAction from '@/actions/loadTeramindLoginSessions';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import upsertTeramindAgentsAction from '@/actions/upsertTeramindAgents';
import updateTeramindAgentLinksAction from '@/actions/updateTeramindAgentLinks';
import upsertTeramindSessionsAction from '@/actions/upsertTeramindSessions';
import upsertTeramindPullLogAction from '@/actions/upsertTeramindPullLog';
import { unwrapRows, normalizeAgent, linkAgents, normalizeSession } from '@/app/lib/teramindRows';
import { sessionClock } from '@/app/lib/teramindTime';
import { pullChunks, isTruncated } from '@/app/lib/teramindPull';
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
  const [fetchLoginSessions]  = useMutateAction(loadTeramindLoginSessionsAction);
  const [fetchEmployees]      = useMutateAction(loadAttendanceEmployeesAction);
  const [upsertAgents]        = useMutateAction(upsertTeramindAgentsAction);
  const [linkAgentsAction]    = useMutateAction(updateTeramindAgentLinksAction);
  const [upsertSessions]      = useMutateAction(upsertTeramindSessionsAction);
  const [upsertPullLog]       = useMutateAction(upsertTeramindPullLogAction);

  const syncAgents = useCallback(async (): Promise<SyncAgentsResult> => {
    setSyncing(true);
    setError(null);
    try {
      // 1. Fetch the full Teramind roster
      const dirResp = await fetchDirectory({});
      const dirRows = unwrapRows(dirResp);
      const allAgents: TeramindAgent[] = dirRows
        .map(r => normalizeAgent(r))
        .filter((a): a is TeramindAgent => a !== null);

      // 2. Load already-saved agents to know which are already linked
      const savedResp = await fetchSavedAgents({});
      const savedRows = rowsOf(savedResp);
      const linkedIds = new Set<number>(
        savedRows
          .filter(r => r.employee_id != null)
          .map(r => Number(r.agent_id))
      );

      // 3. Keep non-deleted agents OR already-linked ones
      const keptAgents = allAgents.filter(a => !a.deleted || linkedIds.has(a.agent_id));

      // 4. Upsert in chunks of 200, attaching the raw directory row
      for (const chunk of chunkArray(keptAgents, 200)) {
        const rows = chunk.map((a, i) => ({
          agent_id: a.agent_id,
          email: a.email,
          name: a.name,
          deleted: a.deleted,
          raw: dirRows[allAgents.indexOf(a)] ?? a,
        }));
        await upsertAgents({ rows: JSON.stringify(rows) });
      }

      // 5. Load active employees
      const empResp = await fetchEmployees({ viewAs });
      const employees = rowsOf(empResp).map(e => ({
        id: Number(e.id),
        teramind_email: String(e.email ?? ''),
      }));

      // 6. Link agents to employees
      const { links, unlinkedEmployees } = linkAgents(keptAgents, employees);

      // 7. Bulk-update auto links
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

    // 1. Check at least one linked agent exists
    const savedResp = await fetchSavedAgents({});
    const savedRows = rowsOf(savedResp);
    const linkedAgentIds = new Set<number>(
      savedRows
        .filter(r => r.employee_id != null)
        .map(r => Number(r.agent_id))
    );
    if (linkedAgentIds.size === 0) {
      setPulling(false);
      throw new Error('Sync the roster and link at least one employee before pulling.');
    }

    let fetched = 0;
    let saved   = 0;
    let dropped = 0;
    let truncated = false;

    try {
      const chunks = pullChunks(from, to);

      for (const chunk of chunks) {
        // 2. Fetch sessions for this chunk
        const resp = await fetchLoginSessions({ dateFrom: chunk.from, dateTo: chunk.to });
        const rawRows = unwrapRows(resp);
        fetched += rawRows.length;
        if (isTruncated(rawRows.length, 50000)) truncated = true;

        // 3. Normalize and filter by linked agents
        const sessions: (TeramindSessionSave & { raw: unknown })[] = [];
        for (const row of rawRows) {
          const session = normalizeSession(row, sessionClock);
          if (session === null) { dropped++; continue; }
          if (!linkedAgentIds.has(session.agent_id)) { dropped++; continue; }
          sessions.push({ ...session, raw: row });
        }

        // 4. Upsert sessions in chunks of 200
        for (const batch of chunkArray(sessions, 200)) {
          const rows = batch.map(s => ({
            agent_id:    s.agent_id,
            work_date:   s.work_date,
            started_et:  s.started_et,
            finished_et: s.finished_et,
            started_raw: s.started_raw,
            duration_s:  s.duration_s,
            computer:    s.computer,
            raw:         s.raw,
          }));
          await upsertSessions({ rows: JSON.stringify(rows) });
          saved += rows.length;
        }
      }

      // 5. Write pull log on success
      await upsertPullLog({
        date_from:   from,
        date_to:     to,
        pulled_by:   viewerEmail,
        trigger,
        agent_count: linkedAgentIds.size,
        row_count:   fetched,
        saved_count: saved,
        truncated,
        error:       '',
      });

      return { fetched, saved, dropped, truncated };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // 6. Best-effort log on failure
      await upsertPullLog({
        date_from:   from,
        date_to:     to,
        pulled_by:   viewerEmail,
        trigger,
        agent_count: linkedAgentIds.size,
        row_count:   fetched,
        saved_count: 0,
        truncated,
        error:       msg,
      }).catch(() => undefined);
      throw e;
    } finally {
      setPulling(false);
    }
  }, [fetchSavedAgents, fetchLoginSessions, upsertSessions, upsertPullLog, viewerEmail]);

  return { syncAgents, pullRange, syncing, pulling, error };
}
