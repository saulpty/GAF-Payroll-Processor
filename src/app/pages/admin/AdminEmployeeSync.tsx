import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Users, Loader2, Tag, UserCog, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import loadEmployeeDirectoryAction from '@/actions/loadEmployeeDirectory';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import updateEmployeeFlagAction from '@/actions/updateEmployeeFlag';
import updateEmployeeRoleManagerAction from '@/actions/updateEmployeeRoleManager';
import upsertEmployeeAction from '@/actions/upsertEmployee';
import loadSchedulesAction from '@/actions/loadSchedules';
import loadNameAliasesAction from '@/actions/loadNameAliases';

type DbEmployee = {
  id: number; display_name: string; teramind_email: string;
  company_domain: string; active: boolean; schedule_id: number; schedule_name: string;
  is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean;
  role?: string; manager?: string;
};
type Schedule = { id: number; schedule_name: string };
type NameAlias = { alias_text: string; employee_id: number; display_name: string };
type MondayEmp = {
  id: string; name: string; email: string; companyEmail: string;
  teramindEmail?: string; allEmails?: string[]; role?: string; manager?: string;
};
type SyncStatus = 'matched' | 'new' | 'missing';
type SyncRow = {
  status: SyncStatus; mondayName: string; mondayEmail: string;
  mondayRole: string; mondayManager: string;
  dbEmployee: DbEmployee | null; dbActive: boolean;
};

// ── helpers ────────────────────────────────────────────────────────────────

function extractEmail(col: { text: string; value: string } | undefined): string {
  if (!col) return '';
  if (col.text && col.text.includes('@')) return col.text.toLowerCase().trim();
  if (col.value) {
    try {
      const parsed = JSON.parse(col.value);
      const e = parsed?.email || parsed?.text || '';
      if (e.includes('@')) return e.toLowerCase().trim();
    } catch { /* ignore */ }
  }
  return '';
}

function parseMondayDirectory(raw: unknown): MondayEmp[] {
  try {
    const data = (raw as { data?: { boards?: { columns?: { id: string; title: string }[]; items_page?: { items?: unknown[] } }[] } })?.data;
    const board = data?.boards?.[0];
    const items = board?.items_page?.items ?? [];
    const colTitles = new Map<string, string>((board?.columns ?? []).map(c => [c.id, (c.title || '').toLowerCase()]));
    return (items as { id: string; name: string; column_values: { id: string; text: string; value: string }[] }[]).map(item => {
      const cols = item.column_values ?? [];
      const byTitle = (re: RegExp) =>
        (cols.find(c => re.test(colTitles.get(c.id) || ''))?.text || '').trim();
      // 'text' col = Position on board 8661565945
      const roleByColId = (cols.find(c => c.id === 'text')?.text || '').trim();
      const role    = roleByColId || byTitle(/\b(role|puesto|cargo|position|posici|title|job)\b/);
      const manager = byTitle(/\b(manager|supervisor|jefe|gerente|reports?\s*to|lead|boss)\b/);
      const emailCols = cols.filter(c => extractEmail(c) !== '');
      const companyEmailCol =
        emailCols.find(c => /company|corp|work|empresa/.test(c.id)) ||
        emailCols.find(c => /company|corp|work|empresa/.test((c.text || '').toLowerCase())) ||
        emailCols[1] || emailCols[0];
      const teramindEmailCol =
        emailCols.find(c => /teramind|personal|priv/.test(c.id)) ||
        emailCols.find(c => c !== companyEmailCol) ||
        emailCols[0];
      const companyEmail = extractEmail(companyEmailCol);
      const teramindEmail = extractEmail(teramindEmailCol !== companyEmailCol ? teramindEmailCol : undefined);
      return {
        id: item.id, name: item.name,
        email: companyEmail || teramindEmail,
        companyEmail, teramindEmail,
        allEmails: emailCols.map(c => extractEmail(c)).filter(Boolean),
        role, manager,
      };
    }).filter(e => e.name?.trim());
  } catch { return []; }
}

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'van', 'von', 'da', 'di', 'do', 'das', 'dos']);

function normalizeName(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Significant (non-particle) tokens from a normalized name */
function sigTokens(name: string): string[] {
  return normalizeName(name).split(/\s+/).filter(t => t.length > 1 && !PARTICLES.has(t));
}

function tokenMatch(a: string, b: string): boolean {
  const ta = sigTokens(a);
  const tb = sigTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const shared = ta.filter(t => tb.includes(t));
  // require ≥2 shared sig-tokens, OR ≥1 when either name has only 1 sig-token
  const needed = Math.min(2, Math.min(ta.length, tb.length));
  return shared.length >= needed;
}

function roleManagerChanged(row: SyncRow): boolean {
  const db = row.dbEmployee;
  if (!db) return false;
  return (row.mondayRole || '') !== (db.role || '') || (row.mondayManager || '') !== (db.manager || '');
}

// ── collapsible section ────────────────────────────────────────────────────

function Section({ title, count, color, defaultOpen = false, children, action }: {
  title: string; count: number; color: string; defaultOpen?: boolean;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className={`border-${color}-200${color === 'slate' ? '' : ` bg-${color}-50/30`}`}>
      <CardHeader className="py-3 px-4 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center justify-between">
          <CardTitle className={`text-${color}-800 flex items-center gap-2 text-base font-semibold`}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {title}
            <Badge className={`ml-1 text-xs bg-${color}-100 text-${color}-800 border-${color}-200`}>{count}</Badge>
          </CardTitle>
          {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0 space-y-2">{children}</CardContent>}
    </Card>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function AdminEmployeeSync() {
  const [directoryRaw, dirLoading, dirError, reloadDir] = useLoadAction(loadEmployeeDirectoryAction, null);
  const [allEmployees, , , reloadEmps] = useLoadAction(loadAllEmployeesAction, [] as DbEmployee[]);
  const [schedules] = useLoadAction(loadSchedulesAction, [] as Schedule[]);
  const [nameAliasesRaw] = useLoadAction(loadNameAliasesAction, [] as NameAlias[]);
  const [updateFlag] = useMutateAction(updateEmployeeFlagAction);
  const [updateRoleManager] = useMutateAction(updateEmployeeRoleManagerAction);
  const [upsertEmp] = useMutateAction(upsertEmployeeAction);

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [debugMode, setDebugMode] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllDone, setSyncAllDone] = useState(false);

  const mondayEmps = parseMondayDirectory(directoryRaw);
  const dbEmps = allEmployees as DbEmployee[];
  const nameAliases = nameAliasesRaw as NameAlias[];

  const aliasMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of nameAliases) m.set(normalizeName(a.alias_text), a.employee_id);
    return m;
  }, [nameAliases]);

  const syncRows: SyncRow[] = useMemo(() => {
    const rows: SyncRow[] = [];
    const matchedDbIds = new Set<number>();

    // Build a set of all candidate emails for each DB employee:
    //   - teramind_email as-is
    //   - username portion of teramind_email + @ + company_domain (derived work email)
    function dbEmails(e: DbEmployee): string[] {
      const emails: string[] = [];
      if (e.teramind_email) emails.push(e.teramind_email.toLowerCase().trim());
      if (e.teramind_email && e.company_domain) {
        const user = e.teramind_email.split('@')[0];
        const derived = `${user}@${e.company_domain}`.toLowerCase().trim();
        if (!emails.includes(derived)) emails.push(derived);
      }
      return emails;
    }

    // Build reverse index: email → DbEmployee for O(1) lookup
    const emailIndex = new Map<string, DbEmployee>();
    for (const emp of dbEmps) {
      for (const em of dbEmails(emp)) {
        if (!emailIndex.has(em)) emailIndex.set(em, emp);
      }
    }

    for (const me of mondayEmps) {
      const normMondayName = normalizeName(me.name);
      const allMondayEmails = [...new Set(
        (me.allEmails ?? []).concat([me.email, me.companyEmail, me.teramindEmail ?? '']).filter(Boolean).map(e => e.toLowerCase().trim())
      )];

      // 1. Email-first: any Monday email hits DB email index
      let dbMatch: DbEmployee | undefined;
      for (const em of allMondayEmails) {
        const hit = emailIndex.get(em);
        if (hit) { dbMatch = hit; break; }
      }

      // 2. Alias map (name-based fallback)
      if (!dbMatch) {
        const aliasEmpId = aliasMap.get(normMondayName);
        if (aliasEmpId) dbMatch = dbEmps.find(e => e.id === aliasEmpId);
      }

      // 3. Exact normalized display_name
      if (!dbMatch) {
        dbMatch = dbEmps.find(e => normalizeName(e.display_name) === normMondayName);
      }

      // 4. Strip-particle token match (handles "Jose de Hermoso" ↔ "Jose Hermoso")
      if (!dbMatch) {
        dbMatch = dbEmps.find(e => tokenMatch(e.display_name, me.name));
      }

      if (dbMatch) {
        matchedDbIds.add(dbMatch.id);
        rows.push({ status: 'matched', mondayName: me.name, mondayEmail: me.email, mondayRole: me.role || '', mondayManager: me.manager || '', dbEmployee: dbMatch, dbActive: dbMatch.active });
      } else {
        rows.push({ status: 'new', mondayName: me.name, mondayEmail: me.email, mondayRole: me.role || '', mondayManager: me.manager || '', dbEmployee: null, dbActive: false });
      }
    }
    for (const emp of dbEmps) {
      if (!matchedDbIds.has(emp.id)) {
        rows.push({ status: 'missing', mondayName: '', mondayEmail: '', mondayRole: '', mondayManager: '', dbEmployee: emp, dbActive: emp.active });
      }
    }
    return rows;
  }, [mondayEmps, dbEmps, aliasMap]);

  const matched  = syncRows.filter(r => r.status === 'matched');
  const newOnes  = syncRows.filter(r => r.status === 'new');
  const missing  = syncRows.filter(r => r.status === 'missing');
  const needsActivation   = matched.filter(r => !r.dbActive);
  const needsDeactivation = missing.filter(r => r.dbActive);
  const needsRoleSync     = matched.filter(r => roleManagerChanged(r));

  const handleToggleActive = async (emp: DbEmployee, newActive: boolean, key: string) => {
    setSaving(p => ({ ...p, [key]: true }));
    try {
      await updateFlag({ id: emp.id, is_grace_list: emp.is_grace_list ?? false, is_macbook_swap: emp.is_macbook_swap ?? false, excluded_from_payroll: emp.excluded_from_payroll ?? false, active: newActive });
      setDone(p => ({ ...p, [key]: true }));
      reloadEmps();
    } finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const handleSyncRoleManager = async (row: SyncRow, key: string) => {
    if (!row.dbEmployee) return;
    setSaving(p => ({ ...p, [key]: true }));
    try {
      await updateRoleManager({ id: row.dbEmployee.id, role: row.mondayRole || null, manager: row.mondayManager || null });
      setDone(p => ({ ...p, [key]: true }));
      reloadEmps();
    } finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const handleSyncAllRoleManager = async () => {
    setSyncingAll(true);
    try {
      for (const row of needsRoleSync) {
        if (!row.dbEmployee) continue;
        await updateRoleManager({ id: row.dbEmployee.id, role: row.mondayRole || null, manager: row.mondayManager || null });
      }
      setSyncAllDone(true);
      reloadEmps();
    } finally { setSyncingAll(false); }
  };

  const defaultScheduleId = (schedules as Schedule[])[0]?.id ?? 1;

  const handleAddEmployee = async (me: MondayEmp, key: string) => {
    setSaving(p => ({ ...p, [key]: true }));
    try {
      const domain = me.email.includes('@') ? me.email.split('@')[1] : '';
      await upsertEmp({
        display_name: me.name,
        teramind_email: me.email || me.name.toLowerCase().replace(/\s+/g, '.'),
        company_domain: domain,
        schedule_id: defaultScheduleId,
        is_grace_list: false,
        is_macbook_swap: false,
        excluded_from_payroll: false,
        active: true,
        notes: 'Added via Monday directory sync',
        role: me.role || null,
        manager: me.manager || null,
      });
      setDone(p => ({ ...p, [key]: true }));
      reloadEmps();
    } finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const rawCols = (() => {
    try {
      const data = (directoryRaw as { data?: { boards?: { columns?: { id: string; title: string; type: string }[] }[] } })?.data;
      return data?.boards?.[0]?.columns ?? [];
    } catch { return []; }
  })();

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> Monday Directory Sync
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sync active status, role, and manager from the Panama Employee Directory board.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDebugMode(d => !d)}>
            {debugMode ? 'Hide Debug' : 'Debug Columns'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { reloadDir(); reloadEmps(); setSyncAllDone(false); setDone({}); }}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {dirLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading Monday directory…
        </div>
      )}
      {dirError && (
        <div className="text-red-600 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" /> Failed to load Monday board: {String(dirError)}
        </div>
      )}

      {/* Debug panel */}
      {debugMode && rawCols.length > 0 && (
        <Card className="border-slate-200 bg-slate-50">
          <CardHeader><CardTitle className="text-sm">Board Columns (debug)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {rawCols.map((c: { id: string; title: string; type: string }) => (
                <Badge key={c.id} variant="outline" className="font-mono text-xs">
                  {c.id} · {c.title} · {c.type}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {mondayEmps.length} items parsed · {mondayEmps.filter(e => e.role).length} with role · sample:{' '}
              <code className="text-xs">"{mondayEmps[0]?.name}" role="{mondayEmps[0]?.role}" emails={mondayEmps[0]?.allEmails?.join(', ')}</code>
            </p>
            {/* Unmatched detail for debugging */}
            {newOnes.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-amber-700">Unmatched Monday entries ({newOnes.length}) — click to expand</summary>
                <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto">
                  {newOnes.map((r, i) => {
                    const me = mondayEmps.find(e => e.name === r.mondayName);
                    return (
                      <div key={i} className="text-xs font-mono text-slate-600">
                        <span className="font-semibold">{r.mondayName}</span>
                        {' · '}all emails: [{me?.allEmails?.join(', ') || '—'}]
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {!dirLoading && mondayEmps.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'In Monday',   value: mondayEmps.length,      color: 'text-blue-700' },
            { label: 'Matched',     value: matched.length,         color: 'text-green-700' },
            { label: 'Not in DB',   value: newOnes.length,         color: 'text-amber-700' },
            { label: 'Not in Mon.', value: missing.length,         color: 'text-red-700' },
            { label: 'Role/Mgr Δ', value: needsRoleSync.length,   color: 'text-purple-700' },
          ].map(s => (
            <Card key={s.label} className="text-center py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Role / Manager Out of Sync ── */}
      {needsRoleSync.length > 0 && (
        <Section title="Role / Manager Out of Sync" count={needsRoleSync.length} color="purple" defaultOpen
          action={
            <Button size="sm" disabled={syncingAll || syncAllDone} onClick={handleSyncAllRoleManager}
              className="bg-purple-600 hover:bg-purple-700 text-white">
              {syncingAll ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Syncing…</> :
                syncAllDone ? <><CheckCircle className="w-3 h-3 mr-1" />All Synced</> :
                <><UserCog className="w-3 h-3 mr-1" />Sync All</>}
            </Button>
          }>
          {needsRoleSync.map(r => {
            const key = `rm-${r.dbEmployee!.id}`;
            return (
              <div key={key} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-purple-200">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{r.dbEmployee!.display_name}</span>
                  <div className="flex gap-4 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span>
                      <span className="font-semibold text-purple-700">Role:</span>{' '}
                      <span className="line-through text-slate-400">{r.dbEmployee!.role || '—'}</span>
                      {' → '}<span className="text-foreground font-medium">{r.mondayRole || '—'}</span>
                    </span>
                    <span>
                      <span className="font-semibold text-purple-700">Manager:</span>{' '}
                      <span className="line-through text-slate-400">{r.dbEmployee!.manager || '—'}</span>
                      {' → '}<span className="text-foreground font-medium">{r.mondayManager || '—'}</span>
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={saving[key] || done[key]}
                  onClick={() => handleSyncRoleManager(r, key)}
                  className="ml-3 text-purple-700 border-purple-300 hover:bg-purple-50 shrink-0">
                  {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : done[key] ? <CheckCircle className="w-3 h-3" /> : 'Sync'}
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── Active Status Mismatches ── */}
      {(needsActivation.length > 0 || needsDeactivation.length > 0) && (
        <Section title="Active Status Mismatches" count={needsActivation.length + needsDeactivation.length} color="amber" defaultOpen>
          {needsDeactivation.map(r => {
            const key = `deact-${r.dbEmployee!.id}`;
            return (
              <div key={key} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-amber-200">
                <div>
                  <span className="font-medium text-sm">{r.dbEmployee!.display_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.dbEmployee!.teramind_email}</span>
                  <Badge className="ml-2 text-xs bg-green-100 text-green-800 border-green-300">Active in DB</Badge>
                  <Badge className="ml-1 text-xs bg-red-100 text-red-800 border-red-300">Not in Monday</Badge>
                </div>
                <Button size="sm" variant="outline" disabled={saving[key] || done[key]}
                  onClick={() => handleToggleActive(r.dbEmployee!, false, key)}
                  className="text-red-700 border-red-300 hover:bg-red-50">
                  {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : done[key] ? <CheckCircle className="w-3 h-3" /> : 'Mark Inactive'}
                </Button>
              </div>
            );
          })}
          {needsActivation.map(r => {
            const key = `act-${r.dbEmployee!.id}`;
            return (
              <div key={key} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-amber-200">
                <div>
                  <span className="font-medium text-sm">{r.dbEmployee!.display_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.dbEmployee!.teramind_email}</span>
                  <Badge className="ml-2 text-xs bg-red-100 text-red-800 border-red-300">Inactive in DB</Badge>
                  <Badge className="ml-1 text-xs bg-green-100 text-green-800 border-green-300">Active in Monday</Badge>
                </div>
                <Button size="sm" variant="outline" disabled={saving[key] || done[key]}
                  onClick={() => handleToggleActive(r.dbEmployee!, true, key)}
                  className="text-green-700 border-green-300 hover:bg-green-50">
                  {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : done[key] ? <CheckCircle className="w-3 h-3" /> : 'Mark Active'}
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── In Monday, Not in DB ── */}
      {newOnes.length > 0 && (
        <Section title="In Monday, Not in DB" count={newOnes.length} color="blue" defaultOpen>
          {newOnes.map((r, i) => {
            const key = `new-${i}`;
            return (
              <div key={key} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-blue-200">
                <div>
                  <span className="font-medium text-sm">{r.mondayName}</span>
                  {r.mondayEmail && <span className="text-xs text-muted-foreground ml-2">{r.mondayEmail}</span>}
                  {r.mondayRole && <Badge className="ml-2 text-xs bg-purple-100 text-purple-800 border-purple-200">{r.mondayRole}</Badge>}
                  {r.mondayManager && <span className="text-xs text-muted-foreground ml-2">Mgr: {r.mondayManager}</span>}
                </div>
                <Button size="sm" disabled={saving[key] || done[key]}
                  onClick={() => handleAddEmployee({ id: '', name: r.mondayName, email: r.mondayEmail, companyEmail: r.mondayEmail, role: r.mondayRole, manager: r.mondayManager }, key)}>
                  {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : done[key] ? <CheckCircle className="w-3 h-3" /> : 'Add to DB'}
                </Button>
              </div>
            );
          })}
        </Section>
      )}

      {/* ── Matched Employees ── */}
      {matched.length > 0 && (
        <Section title="Matched Employees" count={matched.length} color="green">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-2 py-1.5 font-semibold">Employee</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Email</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Role (DB)</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Manager (DB)</th>
                  <th className="text-left px-2 py-1.5 font-semibold">Status</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {matched.map(r => {
                  const key = `rm-match-${r.dbEmployee!.id}`;
                  const changed = roleManagerChanged(r);
                  return (
                    <tr key={r.dbEmployee!.id} className={`border-b border-border/50 hover:bg-slate-50 ${changed ? 'bg-purple-50/30' : ''}`}>
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{r.dbEmployee!.display_name}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.dbEmployee!.teramind_email}</td>
                      <td className="px-2 py-2 text-xs">
                        {changed && r.mondayRole !== (r.dbEmployee!.role || '') ? (
                          <span className="text-purple-700 font-medium">{r.mondayRole || '—'}<span className="text-slate-400 font-normal line-through ml-1">{r.dbEmployee!.role || ''}</span></span>
                        ) : (r.dbEmployee!.role || <span className="text-slate-300">—</span>)}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {changed && r.mondayManager !== (r.dbEmployee!.manager || '') ? (
                          <span className="text-purple-700 font-medium">{r.mondayManager || '—'}<span className="text-slate-400 font-normal line-through ml-1">{r.dbEmployee!.manager || ''}</span></span>
                        ) : (r.dbEmployee!.manager || <span className="text-slate-300">—</span>)}
                      </td>
                      <td className="px-2 py-2">
                        <Badge className={r.dbActive ? 'bg-green-100 text-green-800 border-green-200 text-xs' : 'bg-slate-100 text-slate-600 border-slate-200 text-xs'}>
                          {r.dbActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {changed && (
                          <Button size="sm" variant="outline" disabled={saving[key] || done[key]}
                            onClick={() => handleSyncRoleManager(r, key)}
                            className="h-6 text-xs text-purple-700 border-purple-300 hover:bg-purple-50">
                            {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : done[key] ? <CheckCircle className="w-3 h-3" /> : 'Sync'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── In DB, Not in Monday ── */}
      {missing.length > 0 && (
        <Section title="In DB, Not in Monday" count={missing.length} color="slate">
          {missing.map(r => (
            <div key={r.dbEmployee!.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-100 text-sm border border-slate-200 bg-white">
              <span className="font-medium">{r.dbEmployee!.display_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{r.dbEmployee!.teramind_email}</span>
                <Badge className={r.dbActive ? 'bg-amber-100 text-amber-800 border-amber-200 text-xs' : 'bg-slate-100 text-slate-600 border-slate-200 text-xs'}>
                  {r.dbActive ? 'Active — possible termination?' : 'Inactive'}
                </Badge>
                {r.dbActive && (
                  <Button size="sm" variant="outline"
                    className="h-6 text-xs text-red-700 border-red-300 hover:bg-red-50"
                    onClick={() => handleToggleActive(r.dbEmployee!, false, `miss-${r.dbEmployee!.id}`)}
                    disabled={saving[`miss-${r.dbEmployee!.id}`] || done[`miss-${r.dbEmployee!.id}`]}>
                    {done[`miss-${r.dbEmployee!.id}`] ? <CheckCircle className="w-3 h-3" /> : 'Mark Inactive'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
