import { useEffect } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import { useTeramindPull } from '@/app/pages/admin/teramind/useTeramindPull';
import { useAccessSync } from '@/app/pages/admin/access/useAccessSync';
import { buildResolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';
import { syncDirectory } from '@/app/pages/admin/employees/syncDirectory';
import { syncRequests } from '@/app/pages/admin/employees/syncRequests';
import { syncAttendanceForms } from '@/app/pages/admin/employees/syncAttendanceForms';
import { syncContracts } from '@/app/pages/admin/employees/syncContracts';
import { easternDate } from '@/app/lib/teramindTime';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import updateEmployeeRoleManagerAction from '@/actions/updateEmployeeRoleManager';
import updateEmployeeFlagAction from '@/actions/updateEmployeeFlag';
import upsertEmployeeAction from '@/actions/upsertEmployee';
import updateEmployeeStartDateAction from '@/actions/updateEmployeeStartDate';
import upsertMondayRequestsAction from '@/actions/upsertMondayRequests';
import upsertMondayAttendanceFormsAction from '@/actions/upsertMondayAttendanceForms';
import upsertMondayContractsAction from '@/actions/upsertMondayContracts';
import updateMondayRequestsDeletedAction from '@/actions/updateMondayRequestsDeleted';
import updateMondayAttendanceFormsDeletedAction from '@/actions/updateMondayAttendanceFormsDeleted';
import updateMondayContractsDeletedAction from '@/actions/updateMondayContractsDeleted';
import loadSyncLogAction from '@/actions/loadSyncLog';
import claimSyncRunAction from '@/actions/claimSyncRun';
import upsertSyncLogAction from '@/actions/upsertSyncLog';

type ConfigRow = { key: string; value: string };
type EmpRow    = {
  id: number; display_name: string; teramind_email: string; company_domain: string;
  active: boolean; is_grace_list: boolean; is_macbook_swap: boolean;
  excluded_from_payroll: boolean; role: string; manager: string;
  start_date: string | null; schedule_id?: number;
};
type AliasRow  = { alias_text: string; employee_id: number };
type SyncLogRow = { id: number; kind: string; ran_at: string; ran_by: string; created: number; updated: number; error: string | null };

function rowsOf(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

// Module-level overlap guard — only one run at a time across re-renders.
let inFlight = false;

/**
 * Silently keeps Monday boards + Teramind roster fresh while a super user has the Hub open.
 * Renders nothing. Fires only for super users; managers are never involved.
 */
export default function MondayAutoSync() {
  const { isSuper } = useViewer();
  const { syncAgents } = useTeramindPull();
  const syncAccess = useAccessSync();

  const [fetchConfig]           = useMutateAction(loadClassificationConfigAction);
  const [fetchEmps]             = useMutateAction(loadAllEmployeesAction);
  const [fetchAliases]          = useMutateAction(loadNameAliasesAction);
  const [pullBoard]             = useMutateAction(pullMondayBoardAction);
  const [updateRoleManager]     = useMutateAction(updateEmployeeRoleManagerAction);
  const [updateFlag]            = useMutateAction(updateEmployeeFlagAction);
  const [upsertEmp]             = useMutateAction(upsertEmployeeAction);
  const [updateStartDate]       = useMutateAction(updateEmployeeStartDateAction);
  const [upsertRequests]        = useMutateAction(upsertMondayRequestsAction);
  const [upsertAttForms]        = useMutateAction(upsertMondayAttendanceFormsAction);
  const [upsertContracts]       = useMutateAction(upsertMondayContractsAction);
  const [delRequests]           = useMutateAction(updateMondayRequestsDeletedAction);
  const [delAttForms]           = useMutateAction(updateMondayAttendanceFormsDeletedAction);
  const [delContracts]          = useMutateAction(updateMondayContractsDeletedAction);
  const [fetchSyncLog]          = useMutateAction(loadSyncLogAction);
  const [claimRun]              = useMutateAction(claimSyncRunAction);
  const [writeSyncLog]          = useMutateAction(upsertSyncLogAction);

  useEffect(() => {
    if (!isSuper) return;

    async function maybeSync() {
      if (document.hidden) return;
      if (inFlight) return;

      // Read shared interval from config
      let intervalMinutes = 15;
      try {
        const cfgResp = await fetchConfig({});
        const rows = rowsOf(cfgResp) as ConfigRow[];
        const row = rows.find(r => r.key === 'sync_every_minutes') ?? rows.find(r => r.key === 'teramind_sync_every_minutes');
        if (row) {
          const parsed = parseInt(row.value, 10);
          if (!isNaN(parsed) && parsed >= 5) intervalMinutes = parsed;
        }
      } catch { /* use default */ }

      const intervalMs = intervalMinutes * 60 * 1000;

      // Load sync_log to decide which boards are due
      let syncLogRows: SyncLogRow[] = [];
      try {
        const logResp = await fetchSyncLog({});
        syncLogRows = rowsOf(logResp) as SyncLogRow[];
      } catch { /* treat as no prior run */ }

      // For a given kind, find the newest successful ran_at timestamp
      function lastSuccessMs(kind: string): number {
        let best = 0;
        for (const r of syncLogRows) {
          if (r.kind !== kind) continue;
          if (r.error && r.error !== '' && r.error !== 'running') continue;
          const ts = r.ran_at ? new Date(r.ran_at).getTime() : 0;
          if (ts > best) best = ts;
        }
        return best;
      }

      const BOARDS: Array<{ kind: string }> = [
        { kind: 'directory' },
        { kind: 'requests' },
        { kind: 'attendance_forms' },
        { kind: 'contracts' },
      ];

      const due = BOARDS.filter(b => {
        const last = lastSuccessMs(b.kind);
        return last === 0 || Date.now() - last >= intervalMs;
      });

      if (due.length === 0) return;

      inFlight = true;
      try {
        // Load shared deps once
        const [empResp, aliasResp] = await Promise.all([fetchEmps({}), fetchAliases({})]);
        const emps = rowsOf(empResp) as EmpRow[];
        const aliases = rowsOf(aliasResp) as AliasRow[];
        const resolve = buildResolver(emps as unknown as Parameters<typeof buildResolver>[0], aliases as unknown as Parameters<typeof buildResolver>[1], normalizeName);

        // Config map (already fetched above but refetch inside for freshness)
        const cfgResp2 = await fetchConfig({});
        const cfgRows = rowsOf(cfgResp2) as ConfigRow[];
        const cfg: Record<string, string> = {};
        for (const r of cfgRows) cfg[r.key] = r.value;

        const defaultScheduleId = (() => {
          const freq: Record<number, number> = {};
          for (const e of emps) {
            const sid = (e as unknown as { schedule_id?: number }).schedule_id;
            if (sid) freq[sid] = (freq[sid] ?? 0) + 1;
          }
          const best = Object.entries(freq).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
          return best ? Number(best[0]) : 1;
        })();

        for (const board of due) {
          // Claim the run at DB level — zero rows = another tab beat us
          let claimId: number | null = null;
          try {
            const claimResp = await claimRun({ kind: board.kind, ranBy: 'auto', intervalMinutes });
            const claimRows = rowsOf(claimResp);
            if (!claimRows.length) continue; // another tab claimed it
            claimId = Number(claimRows[0].id);
          } catch (e) {
            console.warn(`Monday auto-sync claim (${board.kind}) failed:`, e);
            continue;
          }

          let created = 0;
          let updated = 0;
          let errMsg = '';

          try {
            if (board.kind === 'directory') {
              const result = await syncDirectory({
                cfg, pull: (p) => pullBoard(p), resolve,
                upsert: () => Promise.resolve(), markDeleted: () => Promise.resolve(),
                emps, updateRoleManager, updateFlag, upsertEmp, updateStartDate,
                defaultScheduleId,
                askCandidates: 'auto',
                onSummary: () => { /* silent */ },
              });
              created = result.created ?? 0;
              updated = result.matched ?? 0;

              // Also sync access groups, best-effort
              try { await syncAccess(true); } catch (e) {
                console.warn('Monday auto-sync (access groups) failed:', e);
              }
            } else if (board.kind === 'requests') {
              const result = await syncRequests({
                cfg, pull: (p) => pullBoard(p), resolve,
                upsert: (p) => upsertRequests(p), markDeleted: (p) => delRequests(p),
              });
              updated = result.matched;
            } else if (board.kind === 'attendance_forms') {
              const result = await syncAttendanceForms({
                cfg, pull: (p) => pullBoard(p), resolve,
                upsert: (p) => upsertAttForms(p), markDeleted: (p) => delAttForms(p),
              });
              updated = result.matched;
            } else if (board.kind === 'contracts') {
              const result = await syncContracts({
                cfg, pull: (p) => pullBoard(p), resolve,
                upsert: (p) => upsertContracts(p), markDeleted: (p) => delContracts(p),
              });
              updated = result.matched;
            }
          } catch (e) {
            errMsg = e instanceof Error ? e.message : String(e);
            console.warn(`Monday auto-sync (${board.kind}) failed:`, e);
          }

          // Record outcome
          try {
            await writeSyncLog({ id: claimId, created, updated, error: errMsg });
          } catch (we) {
            console.warn(`Monday auto-sync write log (${board.kind}) failed:`, we);
          }
        }

        // ── Teramind roster: at most once per calendar day ──────────────────
        const todayStr = easternDate(Date.now());
        const lastRosterRun = syncLogRows
          .filter(r => r.kind === 'teramind_roster' && (!r.error || r.error === ''))
          .map(r => r.ran_at ? r.ran_at.slice(0, 10) : '')
          .find(d => d === todayStr);

        if (!lastRosterRun) {
          let rosterClaimId: number | null = null;
          try {
            const claimResp = await claimRun({ kind: 'teramind_roster', ranBy: 'auto', intervalMinutes: 1440 });
            const claimRows = rowsOf(claimResp);
            if (claimRows.length) {
              rosterClaimId = Number(claimRows[0].id);
            }
          } catch (e) {
            console.warn('Monday auto-sync claim (teramind_roster) failed:', e);
          }

          if (rosterClaimId !== null) {
            let rosterLinked = 0;
            let rosterErr = '';
            try {
              const result = await syncAgents();
              rosterLinked = result.linked;
            } catch (e) {
              rosterErr = e instanceof Error ? e.message : String(e);
              console.warn('Monday auto-sync (teramind_roster) failed:', e);
            }
            try {
              await writeSyncLog({ id: rosterClaimId, created: 0, updated: rosterLinked, error: rosterErr });
            } catch (we) {
              console.warn('Monday auto-sync write log (teramind_roster) failed:', we);
            }
          }
        }
      } finally {
        inFlight = false;
      }
    }

    maybeSync();
    const timer = setInterval(maybeSync, 60_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);

  return null;
}
