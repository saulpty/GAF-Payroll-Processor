import { useState, useMemo, useCallback } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { AlertCircle, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadNameAliasesAction from '@/actions/loadNameAliases';
import loadMondaySyncLogAction from '@/actions/loadMondaySyncLog';
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
import MondaySyncCard, { SyncLogRow, SyncResult } from './MondaySyncCard';
import ReconciliationTable, { DirectoryItem } from './ReconciliationTable';
import UnmatchedList from './UnmatchedList';
import { buildResolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';
import { requireKeys } from './mondaySync';
import { syncDirectory, DirectoryDeps } from './syncDirectory';
import { syncRequests } from './syncRequests';
import { syncAttendanceForms } from './syncAttendanceForms';
import { syncContracts } from './syncContracts';

type ConfigRow = { key: string; value: string };
type EmpRow    = {
  id: number; display_name: string; teramind_email: string; company_domain: string;
  active: boolean; is_grace_list: boolean; is_macbook_swap: boolean;
  excluded_from_payroll: boolean; role: string; manager: string;
  start_date: string | null;
};
type AliasRow  = { alias_text: string; employee_id: number };

type NewEmpCandidate = { name: string; email: string; role: string; manager: string };

// ── "Add missing" dialog ───────────────────────────────────────────────────────

function AddMissingDialog({ candidates, onConfirm, onCancel, adding }: {
  candidates: NewEmpCandidate[];
  onConfirm: (selected: NewEmpCandidate[]) => void;
  onCancel: () => void;
  adding: boolean;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => candidates.map(() => false));
  const selected = candidates.filter((_, i) => checked[i]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
        <h3 className="font-semibold text-slate-800">Add unmatched Monday employees?</h3>
        <p className="text-xs text-muted-foreground">
          The following Monday items have a non-empty email that doesn't match any employee.
          Select the ones you want to create. Default is skip all.
        </p>
        <div className="max-h-60 overflow-auto flex flex-col gap-1.5">
          {candidates.map((c, i) => (
            <label key={c.email} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-slate-50 border text-xs">
              <input type="checkbox" className="mt-0.5" checked={checked[i]}
                onChange={() => setChecked(p => { const n=[...p]; n[i]=!n[i]; return n; })} />
              <span>
                <span className="font-medium text-slate-800">{c.name}</span>
                {' · '}<span className="font-mono text-slate-500">{c.email}</span>
                {c.role && <span className="text-slate-400"> · {c.role}</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={adding}>Skip all</Button>
          <Button size="sm" onClick={() => onConfirm(selected)} disabled={adding || selected.length === 0}>
            {adding && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            Add {selected.length} employee{selected.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MondayTab ──────────────────────────────────────────────────────────────────

export default function MondayTab() {
  const [configRaw]  = useLoadAction(loadClassificationConfigAction, [] as ConfigRow[]);
  const [empsRaw, , , reloadEmps] = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);
  const [aliasesRaw] = useLoadAction(loadNameAliasesAction, [] as AliasRow[]);
  const [syncLogRaw, , , reloadLog] = useLoadAction(loadMondaySyncLogAction, [] as SyncLogRow[]);

  const [callMondayBoard]  = useMutateAction(pullMondayBoardAction);
  const [updateRoleManager] = useMutateAction(updateEmployeeRoleManagerAction);
  const [updateFlag]        = useMutateAction(updateEmployeeFlagAction);
  const [upsertEmp]         = useMutateAction(upsertEmployeeAction);
  const [updateStartDate]   = useMutateAction(updateEmployeeStartDateAction);
  const [upsertRequests]    = useMutateAction(upsertMondayRequestsAction);
  const [upsertAttForms]    = useMutateAction(upsertMondayAttendanceFormsAction);
  const [upsertContracts]   = useMutateAction(upsertMondayContractsAction);
  const [delRequests]       = useMutateAction(updateMondayRequestsDeletedAction);
  const [delAttForms]       = useMutateAction(updateMondayAttendanceFormsDeletedAction);
  const [delContracts]      = useMutateAction(updateMondayContractsDeletedAction);

  const [pendingCandidates, setPendingCandidates] = useState<NewEmpCandidate[] | null>(null);
  const [pendingResolve, setPendingResolve] = useState<((v: NewEmpCandidate[]) => void) | null>(null);
  const [addingCandidates, setAddingCandidates] = useState(false);
  const [dirSummary, setDirSummary] = useState<string | undefined>(undefined);
  const [mondayDirectory, setMondayDirectory] = useState<DirectoryItem[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const config  = configRaw  as ConfigRow[];
  const emps    = empsRaw    as EmpRow[];
  const aliases = aliasesRaw as AliasRow[];
  const syncLog = syncLogRaw as SyncLogRow[];

  const cfg = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of config) m[r.key] = r.value;
    return m;
  }, [config]);

  const resolver = useMemo(() => buildResolver(emps, aliases, normalizeName), [emps, aliases]);

  const defaultScheduleId = useMemo(() => {
    const freq: Record<number, number> = {};
    for (const e of emps) {
      const sid = (e as unknown as { schedule_id?: number }).schedule_id;
      if (sid) freq[sid] = (freq[sid] ?? 0) + 1;
    }
    const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    return best ? Number(best[0]) : 1;
  }, [emps]);

  const syncLogMap = useMemo(() => {
    const m: Record<string, SyncLogRow> = {};
    for (const r of syncLog) m[r.board_key] = r;
    return m;
  }, [syncLog]);

  const handleDone = useCallback(() => { reloadLog(); reloadEmps(); setRefreshKey(k => k + 1); }, [reloadLog, reloadEmps]);

  const askCandidates = useCallback((candidates: NewEmpCandidate[]): Promise<NewEmpCandidate[]> =>
    new Promise(resolve => {
      setPendingCandidates(candidates);
      setPendingResolve(() => resolve);
    }), []);

  const handleCandidateConfirm = (selected: NewEmpCandidate[]) => {
    setAddingCandidates(true);
    if (pendingResolve) pendingResolve(selected);
    setPendingCandidates(null); setPendingResolve(null); setAddingCandidates(false);
  };
  const handleCandidateCancel = () => {
    if (pendingResolve) pendingResolve([]);
    setPendingCandidates(null); setPendingResolve(null);
  };

  // ── build sync callbacks ────────────────────────────────────────────────────

  const onSyncDirectory = useCallback(async (): Promise<SyncResult> => {
    const dirDeps: DirectoryDeps = {
      cfg, pull: (p) => callMondayBoard(p), resolve: resolver,
      upsert: () => Promise.resolve(), markDeleted: () => Promise.resolve(),
      emps, updateRoleManager, updateFlag, upsertEmp, updateStartDate,
      defaultScheduleId, askCandidates, onSummary: setDirSummary,
      onItems: setMondayDirectory,
    };
    return syncDirectory(dirDeps);
  }, [cfg, emps, resolver, callMondayBoard, updateRoleManager, updateFlag,
      upsertEmp, updateStartDate, defaultScheduleId, askCandidates]);

  const onSyncRequests = useCallback((): Promise<SyncResult> =>
    syncRequests({
      cfg, pull: (p) => callMondayBoard(p), resolve: resolver,
      upsert: (p) => upsertRequests(p), markDeleted: (p) => delRequests(p),
    }), [cfg, resolver, callMondayBoard, upsertRequests, delRequests]);

  const onSyncAttForms = useCallback((): Promise<SyncResult> =>
    syncAttendanceForms({
      cfg, pull: (p) => callMondayBoard(p), resolve: resolver,
      upsert: (p) => upsertAttForms(p), markDeleted: (p) => delAttForms(p),
    }), [cfg, resolver, callMondayBoard, upsertAttForms, delAttForms]);

  const onSyncContracts = useCallback((): Promise<SyncResult> =>
    syncContracts({
      cfg, pull: (p) => callMondayBoard(p), resolve: resolver,
      upsert: (p) => upsertContracts(p), markDeleted: (p) => delContracts(p),
    }), [cfg, resolver, callMondayBoard, upsertContracts, delContracts]);

  // ── config validation (only directory keys block the whole tab) ─────────────

  const configLoaded = config.length > 0;
  const dirCheck = useMemo(() => requireKeys(cfg, [
    'monday_board_directory', 'monday_col_directory_email',
    'monday_col_directory_role', 'monday_col_directory_manager', 'monday_col_directory_active',
  ] as const), [cfg]);

  if (!configLoaded) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading config…
      </div>
    );
  }

  if (!dirCheck.ok) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold mb-1">Missing required config keys — sync disabled</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs font-mono">
              {dirCheck.missing.map(k => <li key={k}>{k}</li>)}
            </ul>
            <p className="mt-2 text-xs text-red-700">Go to Admin → Rules &amp; Config to set these values.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-4">
        <MondaySyncCard boardKey="directory" title="🌎 Employee Directory"
          onSync={onSyncDirectory} log={syncLogMap['directory']}
          onDone={handleDone} summary={dirSummary} />
        <MondaySyncCard boardKey="requests" title="📋 Permissions & Requests"
          onSync={onSyncRequests} log={syncLogMap['requests']} onDone={handleDone} />
        <MondaySyncCard boardKey="attendance_forms" title="📅 Attendance Forms"
          onSync={onSyncAttForms} log={syncLogMap['attendance_forms']} onDone={handleDone} />
        <MondaySyncCard boardKey="contracts" title="📝 Contracts"
          onSync={onSyncContracts} log={syncLogMap['contracts']} onDone={handleDone} />
      </div>

      {pendingCandidates !== null && (
        <AddMissingDialog
          candidates={pendingCandidates}
          onConfirm={handleCandidateConfirm}
          onCancel={handleCandidateCancel}
          adding={addingCandidates}
        />
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5" />
        {emps.length} employees · {aliases.length} aliases loaded
      </div>

      <ReconciliationTable
        mondayDirectory={mondayDirectory}
        resolver={resolver}
        refreshKey={refreshKey}
      />

      <UnmatchedList refreshKey={refreshKey} />
    </div>
  );
}
