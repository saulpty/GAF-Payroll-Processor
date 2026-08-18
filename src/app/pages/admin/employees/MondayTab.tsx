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
import MondaySyncCard, { SyncLogRow, SyncResult } from './MondaySyncCard';
import { buildResolver } from '@/app/lib/mondayResolve';
import { normalizeName } from '@/app/lib/classificationEngine';

// ── types ─────────────────────────────────────────────────────────────────────

type ConfigRow  = { key: string; value: string };
type EmpRow     = {
  id: number; display_name: string; teramind_email: string; company_domain: string;
  active: boolean; is_grace_list: boolean; is_macbook_swap: boolean;
  excluded_from_payroll: boolean; role: string; manager: string;
  start_date: string | null;
};
type AliasRow   = { alias_text: string; employee_id: number };

type MondayItem = {
  id: string;
  name: string;
  group?: { title: string };
  column_values: { id: string; text: string; value: string }[];
};

type PageResult = { cursor: string | null; items: MondayItem[] };

// ── helpers ───────────────────────────────────────────────────────────────────

/** Pull all items from a board, paging with cursor. */
async function pullAllItems(
  boardId: string,
  columnIds: string[],
  callAction: (p: { query: string; variables: Record<string, never> }) => Promise<unknown>,
): Promise<MondayItem[]> {
  const colList = JSON.stringify(columnIds);
  const firstQuery = `{
    boards(ids: [${boardId}]) {
      items_page(limit: 500) {
        cursor
        items {
          id name
          group { title }
          column_values(ids: ${colList}) { id text value }
        }
      }
    }
  }`;

  const raw = await callAction({ query: firstQuery, variables: {} });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstPage = (raw as any)?.data?.boards?.[0]?.items_page as PageResult | undefined;
  if (!firstPage) throw new Error('Monday returned no items_page for board ' + boardId);

  const all: MondayItem[] = [...(firstPage.items ?? [])];
  let cursor = firstPage.cursor ?? null;

  while (cursor) {
    const nextQuery = `{
      next_items_page(limit: 500, cursor: "${cursor}") {
        cursor
        items {
          id name
          group { title }
          column_values(ids: ${colList}) { id text value }
        }
      }
    }`;
    const nextRaw = await callAction({ query: nextQuery, variables: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextPage = (nextRaw as any)?.data?.next_items_page as PageResult | undefined;
    if (!nextPage) break;
    all.push(...(nextPage.items ?? []));
    cursor = nextPage.cursor ?? null;
  }
  return all;
}

function colText(item: MondayItem, colId: string): string {
  return (item.column_values.find(c => c.id === colId)?.text ?? '').trim();
}

// ── config key validation ─────────────────────────────────────────────────────

const REQUIRED_DIR_KEYS = [
  'monday_board_directory',
  'monday_col_directory_email',
  'monday_col_directory_role',
  'monday_col_directory_manager',
  'monday_col_directory_active',
] as const;

const REQUIRED_ONBOARD_KEYS = [
  'monday_board_onboarding',
  'monday_col_onboarding_start_date',
] as const;

type DirKeyMap = Record<typeof REQUIRED_DIR_KEYS[number], string>;
type OnboardKeyMap = Record<typeof REQUIRED_ONBOARD_KEYS[number], string>;

// ── AddMissingDialog ──────────────────────────────────────────────────────────

type NewEmpCandidate = {
  name: string; email: string; role: string; manager: string;
};

function AddMissingDialog({
  candidates, scheduleId, onConfirm, onCancel, adding,
}: {
  candidates: NewEmpCandidate[];
  scheduleId: number;
  onConfirm: (selected: NewEmpCandidate[]) => void;
  onCancel: () => void;
  adding: boolean;
}) {
  const [checked, setChecked] = useState<boolean[]>(() => candidates.map(() => false));
  const selected = candidates.filter((_, i) => checked[i]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
        <h3 className="font-semibold text-slate-800">
          Add unmatched Monday employees?
        </h3>
        <p className="text-xs text-muted-foreground">
          The following Monday items have a non-empty email that doesn't match any employee.
          Select the ones you want to create. Default is skip all.
        </p>
        <div className="max-h-60 overflow-auto flex flex-col gap-1.5">
          {candidates.map((c, i) => (
            <label key={c.email} className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-slate-50 border text-xs">
              <input type="checkbox" className="mt-0.5"
                checked={checked[i]}
                onChange={() => setChecked(p => { const n = [...p]; n[i] = !n[i]; return n; })} />
              <span>
                <span className="font-medium text-slate-800">{c.name}</span>
                {' · '}
                <span className="font-mono text-slate-500">{c.email}</span>
                {c.role && <span className="text-slate-400"> · {c.role}</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onCancel} disabled={adding}>Skip all</Button>
          <Button size="sm" onClick={() => onConfirm(selected)} disabled={adding || selected.length === 0}>
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Add {selected.length} employee{selected.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── MondayTab ─────────────────────────────────────────────────────────────────

export default function MondayTab() {
  const [configRaw]    = useLoadAction(loadClassificationConfigAction, [] as ConfigRow[]);
  const [employeesRaw, , , reloadEmps] = useLoadAction(loadAllEmployeesAction, [] as EmpRow[]);
  const [aliasesRaw]   = useLoadAction(loadNameAliasesAction, [] as AliasRow[]);
  const [syncLogRaw, , , reloadLog] = useLoadAction(loadMondaySyncLogAction, [] as SyncLogRow[]);

  const [callMondayBoard] = useMutateAction(pullMondayBoardAction);
  const [updateRoleManager] = useMutateAction(updateEmployeeRoleManagerAction);
  const [updateFlag] = useMutateAction(updateEmployeeFlagAction);
  const [upsertEmp] = useMutateAction(upsertEmployeeAction);
  const [updateStartDate] = useMutateAction(updateEmployeeStartDateAction);

  // Dialog state for "add missing" candidates
  const [pendingCandidates, setPendingCandidates] = useState<NewEmpCandidate[] | null>(null);
  const [pendingCandidatesResolve, setPendingCandidatesResolve] =
    useState<((v: NewEmpCandidate[]) => void) | null>(null);
  const [addingCandidates, setAddingCandidates] = useState(false);

  // Per-card summary strings shown after sync
  const [dirSummary, setDirSummary] = useState<string | undefined>(undefined);

  const config  = configRaw  as ConfigRow[];
  const emps    = employeesRaw as EmpRow[];
  const aliases = aliasesRaw as AliasRow[];
  const syncLog = syncLogRaw as SyncLogRow[];

  // Build a key→value map from config
  const cfg = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of config) m[r.key] = r.value;
    return m;
  }, [config]);

  // Validate required directory config keys
  const missingDirKeys = useMemo(
    () => REQUIRED_DIR_KEYS.filter(k => !cfg[k]),
    [cfg],
  );
  const missingOnboardKeys = useMemo(
    () => REQUIRED_ONBOARD_KEYS.filter(k => !cfg[k]),
    [cfg],
  );

  const resolver = useMemo(
    () => buildResolver(emps, aliases, normalizeName),
    [emps, aliases],
  );

  const defaultScheduleId = emps[0]?.id ? (
    // Use the most common schedule_id across active employees as default, fallback 1
    (() => {
      const freq: Record<number, number> = {};
      for (const e of emps) {
        const sid = (e as unknown as { schedule_id?: number }).schedule_id;
        if (sid) freq[sid] = (freq[sid] ?? 0) + 1;
      }
      const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      return best ? Number(best[0]) : 1;
    })()
  ) : 1;

  // Helper: ask the user which candidates to add; resolves to the ones they selected
  const askCandidates = useCallback((candidates: NewEmpCandidate[]): Promise<NewEmpCandidate[]> => {
    return new Promise(resolve => {
      setPendingCandidates(candidates);
      setPendingCandidatesResolve(() => resolve);
    });
  }, []);

  const handleCandidateConfirm = async (selected: NewEmpCandidate[]) => {
    setAddingCandidates(true);
    // We need to resolve the promise first so the sync function continues
    if (pendingCandidatesResolve) pendingCandidatesResolve(selected);
    setPendingCandidates(null);
    setPendingCandidatesResolve(null);
    setAddingCandidates(false);
  };

  const handleCandidateCancel = () => {
    if (pendingCandidatesResolve) pendingCandidatesResolve([]);
    setPendingCandidates(null);
    setPendingCandidatesResolve(null);
  };

  // ── Directory sync ────────────────────────────────────────────────────────

  const syncDirectory = useCallback(async (): Promise<SyncResult> => {
    if (missingDirKeys.length > 0) throw new Error('Missing config: ' + missingDirKeys.join(', '));

    const dk = cfg as unknown as DirKeyMap;
    const boardId    = dk['monday_board_directory'];
    const colEmail   = dk['monday_col_directory_email'];
    const colRole    = dk['monday_col_directory_role'];
    const colManager = dk['monday_col_directory_manager'];
    const colActive  = dk['monday_col_directory_active'];

    // Pull all directory items
    const items = await pullAllItems(
      boardId,
      [colEmail, colRole, colManager, colActive],
      (p) => callMondayBoard(p),
    );

    let updatedCount = 0;
    let createdCount = 0;
    let startDatesSet = 0;
    let unmatchedCount = 0;

    const empById = new Map<number, EmpRow>(emps.map(e => [e.id, e]));
    const newCandidates: NewEmpCandidate[] = [];

    for (const item of items) {
      const email   = colText(item, colEmail).toLowerCase();
      const role    = colText(item, colRole);
      const manager = colText(item, colManager);
      const activeText = colText(item, colActive);
      const mondayActive = activeText === 'Active';

      const empId = resolver(item.name, email || null);

      if (empId !== null) {
        const emp = empById.get(empId);
        if (!emp) continue;

        let changed = false;

        // Update role/manager if changed
        if ((role || '') !== emp.role || (manager || '') !== emp.manager) {
          await updateRoleManager({ id: emp.id, role: role || null, manager: manager || null });
          changed = true;
        }

        // Update active flag if changed
        if (mondayActive !== emp.active) {
          await updateFlag({
            id: emp.id,
            is_grace_list: emp.is_grace_list,
            is_macbook_swap: emp.is_macbook_swap,
            excluded_from_payroll: emp.excluded_from_payroll,
            active: mondayActive,
          });
          changed = true;
        }

        if (changed) updatedCount++;
      } else {
        // Unmatched — collect candidates with non-empty email not in DB
        const emailSet = new Set(emps.map(e => e.teramind_email.toLowerCase()));
        if (email && !emailSet.has(email)) {
          newCandidates.push({ name: item.name, email, role, manager });
        }
        unmatchedCount++;
      }
    }

    // Offer to create unmatched employees
    if (newCandidates.length > 0) {
      const selected = await askCandidates(newCandidates);
      for (const c of selected) {
        const domain = c.email.includes('@') ? c.email.split('@')[1] : '';
        await upsertEmp({
          display_name: c.name,
          teramind_email: c.email,
          company_domain: domain,
          schedule_id: defaultScheduleId,
          is_grace_list: false,
          is_macbook_swap: false,
          excluded_from_payroll: false,
          active: true,
          notes: 'Added via Monday directory sync',
          role: c.role || null,
          manager: c.manager || null,
        });
        createdCount++;
      }
    }

    // Start dates from onboarding board
    if (missingOnboardKeys.length === 0) {
      const ok = cfg as unknown as OnboardKeyMap;
      const oBoardId = ok['monday_board_onboarding'];
      const oColStart = ok['monday_col_onboarding_start_date'];

      const oItems = await pullAllItems(
        oBoardId,
        [oColStart],
        (p) => callMondayBoard(p),
      );

      // Re-build emps map after potential creates
      await reloadEmps();
      const freshEmps = emps; // will use the current snapshot; reloadEmps triggers re-render next cycle

      for (const oItem of oItems) {
        const dateText = colText(oItem, oColStart);
        if (!dateText) continue;
        // Date may come as YYYY-MM-DD from Monday date column text
        const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) continue;
        const dateStr = dateMatch[1];

        const oEmpId = resolver(oItem.name, null);
        if (oEmpId === null) continue;
        const oEmp = empById.get(oEmpId) ?? freshEmps.find(e => e.id === oEmpId);
        if (!oEmp) continue;
        // Only set if start_date is currently empty/null
        if (!oEmp.start_date) {
          await updateStartDate({ display_name: oEmp.display_name, start_date: dateStr });
          startDatesSet++;
        }
      }
    }

    const matched = items.length - unmatchedCount;
    setDirSummary(`${updatedCount} updated · ${createdCount} created · ${startDatesSet} start dates set · ${unmatchedCount} unmatched`);
    return { items: items.length, matched, unmatched: unmatchedCount };
  }, [cfg, emps, resolver, missingDirKeys, missingOnboardKeys, callMondayBoard, updateRoleManager, updateFlag, upsertEmp, updateStartDate, askCandidates, defaultScheduleId, reloadEmps]);

  const syncLogMap = useMemo(() => {
    const m: Record<string, SyncLogRow> = {};
    for (const r of syncLog) m[r.board_key] = r;
    return m;
  }, [syncLog]);

  const handleDone = useCallback(() => {
    reloadLog();
    reloadEmps();
  }, [reloadLog, reloadEmps]);

  // ── missing config banner ──────────────────────────────────────────────────

  const allMissing = [...new Set([...missingDirKeys])];
  const configLoaded = config.length > 0;

  if (!configLoaded) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading config…
      </div>
    );
  }

  if (allMissing.length > 0) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold mb-1">Missing required config keys — sync disabled</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs font-mono">
              {allMissing.map(k => <li key={k}>{k}</li>)}
            </ul>
            <p className="mt-2 text-xs text-red-700">
              Go to Admin → Rules &amp; Config to set these values.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── main render ───────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Directory card — fully wired */}
        <MondaySyncCard
          boardKey="directory"
          title="🌎 Employee Directory"
          onSync={syncDirectory}
          log={syncLogMap['directory']}
          onDone={handleDone}
          summary={dirSummary}
        />

        {/* Requests — next step */}
        <MondaySyncCard
          boardKey="requests"
          title="📋 Permissions & Requests"
          onSync={null}
          log={syncLogMap['requests']}
          onDone={handleDone}
        />

        {/* Attendance forms — next step */}
        <MondaySyncCard
          boardKey="attendance_forms"
          title="📅 Attendance Forms"
          onSync={null}
          log={syncLogMap['attendance_forms']}
          onDone={handleDone}
        />

        {/* Contracts — next step */}
        <MondaySyncCard
          boardKey="contracts"
          title="📝 Contracts"
          onSync={null}
          log={syncLogMap['contracts']}
          onDone={handleDone}
        />
      </div>

      {/* "Add missing" confirmation dialog */}
      {pendingCandidates !== null && (
        <AddMissingDialog
          candidates={pendingCandidates}
          scheduleId={defaultScheduleId}
          onConfirm={handleCandidateConfirm}
          onCancel={handleCandidateCancel}
          adding={addingCandidates}
        />
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5" />
        {emps.length} employees · {aliases.length} aliases loaded
      </div>
    </div>
  );
}
