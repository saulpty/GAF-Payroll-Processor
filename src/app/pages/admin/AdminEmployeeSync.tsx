import { useState } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import loadEmployeeDirectoryAction from '@/actions/loadEmployeeDirectory';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import updateEmployeeFlagAction from '@/actions/updateEmployeeFlag';
import upsertEmployeeAction from '@/actions/upsertEmployee';
import loadSchedulesAction from '@/actions/loadSchedules';
import loadNameAliasesAction from '@/actions/loadNameAliases';

type DbEmployee = {
  id: number; display_name: string; teramind_email: string;
  company_domain: string; active: boolean; schedule_id: number; schedule_name: string;
  is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean;
};
type Schedule = { id: number; schedule_name: string };
type NameAlias = { alias_text: string; employee_id: number; display_name: string };

type MondayEmp = {
  id: string;
  name: string;
  email: string;
  companyEmail: string;
  teramindEmail?: string;
  allEmails?: string[];
};

type SyncStatus = 'matched' | 'new' | 'missing';
type SyncRow = {
  status: SyncStatus;
  mondayName: string;
  mondayEmail: string;
  dbEmployee: DbEmployee | null;
  dbActive: boolean;
};

// Extract a plain email string from a Monday column_value (handles JSON email type)
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
    const data = (raw as { data?: { boards?: { items_page?: { items?: unknown[] } }[] } })?.data;
    const items = data?.boards?.[0]?.items_page?.items ?? [];
    return (items as { id: string; name: string; column_values: { id: string; text: string; value: string }[] }[]).map(item => {
      const cols = item.column_values ?? [];

      // Collect ALL columns that contain an email address — we'll pick the best match
      const emailCols = cols.filter(c => extractEmail(c) !== '');
      // Prefer columns whose id contains "email", "correo", "company", "work", "corp"
      const companyEmailCol =
        emailCols.find(c => /company|corp|work|empresa/.test(c.id)) ||
        emailCols.find(c => /company|corp|work|empresa/.test((c.text || '').toLowerCase())) ||
        emailCols[1] || // second email col is often the work email
        emailCols[0];

      const teramindEmailCol =
        emailCols.find(c => /teramind|personal|priv/.test(c.id)) ||
        emailCols.find(c => c !== companyEmailCol) ||
        emailCols[0];

      const companyEmail = extractEmail(companyEmailCol);
      const teramindEmail = extractEmail(teramindEmailCol !== companyEmailCol ? teramindEmailCol : undefined);

      return {
        id: item.id,
        name: item.name,
        // companyEmail is our primary match key
        email: companyEmail || teramindEmail,
        companyEmail,
        teramindEmail,
        allEmails: emailCols.map(c => extractEmail(c)).filter(Boolean),
      };
    }).filter(e => e.name?.trim());
  } catch {
    return [];
  }
}

function normalizeName(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function AdminEmployeeSync() {
  const [directoryRaw, dirLoading, dirError, reloadDir] = useLoadAction(loadEmployeeDirectoryAction, null);
  const [allEmployees, , , reloadEmps] = useLoadAction(loadAllEmployeesAction, [] as DbEmployee[]);
  const [schedules] = useLoadAction(loadSchedulesAction, [] as Schedule[]);
  const [nameAliasesRaw] = useLoadAction(loadNameAliasesAction, [] as NameAlias[]);
  const [updateFlag] = useMutateAction(updateEmployeeFlagAction);
  const [upsertEmp] = useMutateAction(upsertEmployeeAction);

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [debugMode, setDebugMode] = useState(false);

  const mondayEmps = parseMondayDirectory(directoryRaw);
  const dbEmps = allEmployees as DbEmployee[];
  const nameAliases = nameAliasesRaw as NameAlias[];

  // Build alias lookup: normalizedAlias → employee_id
  const aliasMap = new Map<string, number>();
  for (const a of nameAliases) {
    aliasMap.set(normalizeName(a.alias_text), a.employee_id);
  }

  // Token-based name match: all tokens of mondayName appear in dbName or vice-versa
  function tokenMatch(a: string, b: string): boolean {
    const ta = normalizeName(a).split(/\s+/).filter(Boolean);
    const tb = normalizeName(b).split(/\s+/).filter(Boolean);
    if (ta.length === 0 || tb.length === 0) return false;
    // At least 2 tokens match (covers "First Last" vs "First Middle Last")
    const shared = ta.filter(t => tb.includes(t));
    return shared.length >= Math.min(2, Math.min(ta.length, tb.length));
  }

  // Build sync rows
  const syncRows: SyncRow[] = [];
  const matchedDbIds = new Set<number>();

  for (const me of mondayEmps) {
    const normMondayName = normalizeName(me.name);
    const allMondayEmails = me.allEmails ?? [me.email, me.companyEmail].filter(Boolean);

    // 1. Match any Monday email against teramind_email (exact)
    let dbMatch = dbEmps.find(e =>
      e.teramind_email && allMondayEmails.includes(e.teramind_email.toLowerCase())
    );
    // 2. Match any Monday email's domain against company_domain
    if (!dbMatch) {
      dbMatch = dbEmps.find(e =>
        e.company_domain && allMondayEmails.some(em => em.endsWith('@' + e.company_domain) && em.split('@')[0] === e.teramind_email?.split('@')[0])
      );
    }
    // 3. Match company_domain portion of any Monday email against DB company_domain
    if (!dbMatch && me.companyEmail) {
      const mondayDomain = me.companyEmail.split('@')[1] ?? '';
      const mondayUser = me.companyEmail.split('@')[0] ?? '';
      dbMatch = dbEmps.find(e =>
        e.company_domain === mondayDomain &&
        normalizeName(e.display_name).split(' ')[0] === normalizeName(me.name).split(' ')[0]
      );
      // fallback: just domain + last name
      if (!dbMatch) {
        dbMatch = dbEmps.find(e =>
          e.company_domain === mondayDomain && mondayUser &&
          normalizeName(e.teramind_email?.split('@')[0] ?? '') === normalizeName(mondayUser)
        );
      }
    }
    // 4. Alias match (Monday name is a known alias)
    if (!dbMatch) {
      const aliasEmpId = aliasMap.get(normMondayName);
      if (aliasEmpId) dbMatch = dbEmps.find(e => e.id === aliasEmpId);
    }
    // 5. Exact normalized display_name match
    if (!dbMatch) {
      dbMatch = dbEmps.find(e => normalizeName(e.display_name) === normMondayName);
    }
    // 6. Token-based fuzzy name match
    if (!dbMatch) {
      dbMatch = dbEmps.find(e => tokenMatch(e.display_name, me.name));
    }

    if (dbMatch) {
      matchedDbIds.add(dbMatch.id);
      syncRows.push({ status: 'matched', mondayName: me.name, mondayEmail: me.email, dbEmployee: dbMatch, dbActive: dbMatch.active });
    } else {
      syncRows.push({ status: 'new', mondayName: me.name, mondayEmail: me.email, dbEmployee: null, dbActive: false });
    }
  }

  // DB employees not in Monday directory → potentially terminated
  for (const emp of dbEmps) {
    if (!matchedDbIds.has(emp.id)) {
      syncRows.push({ status: 'missing', mondayName: '', mondayEmail: '', dbEmployee: emp, dbActive: emp.active });
    }
  }

  const matched = syncRows.filter(r => r.status === 'matched');
  const newOnes = syncRows.filter(r => r.status === 'new');
  const missing = syncRows.filter(r => r.status === 'missing');
  // Matched but DB says inactive → needs re-activation
  const needsActivation = matched.filter(r => !r.dbActive);
  // Missing and DB says active → needs deactivation
  const needsDeactivation = missing.filter(r => r.dbActive);

  const handleToggleActive = async (emp: DbEmployee, newActive: boolean, key: string) => {
    setSaving(p => ({ ...p, [key]: true }));
    try {
      await updateFlag({ id: emp.id, is_grace_list: emp.is_grace_list ?? false, is_macbook_swap: emp.is_macbook_swap ?? false, excluded_from_payroll: emp.excluded_from_payroll ?? false, active: newActive });
      setDone(p => ({ ...p, [key]: true }));
      reloadEmps();
    } finally {
      setSaving(p => ({ ...p, [key]: false }));
    }
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
        active: true,
        notes: 'Added via Monday directory sync',
      });
      setDone(p => ({ ...p, [key]: true }));
      reloadEmps();
    } finally {
      setSaving(p => ({ ...p, [key]: false }));
    }
  };

  // Raw columns debug info
  const rawCols = (() => {
    try {
      const data = (directoryRaw as { data?: { boards?: { columns?: { id: string; title: string; type: string }[] }[] } })?.data;
      return data?.boards?.[0]?.columns ?? [];
    } catch { return []; }
  })();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" /> Monday Directory Sync
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Compare the Panama Employee Directory board against the payroll DB to keep active status in sync.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDebugMode(d => !d)}>
            {debugMode ? 'Hide Debug' : 'Debug Columns'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { reloadDir(); reloadEmps(); }}>
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
              {mondayEmps.length} items parsed. Sample emails from first item:{' '}
              <code className="text-xs">{mondayEmps[0]?.allEmails?.join(', ') || 'none found'}</code>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {!dirLoading && mondayEmps.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'In Monday', value: mondayEmps.length, color: 'text-blue-700' },
            { label: 'Matched', value: matched.length, color: 'text-green-700' },
            { label: 'Not in DB', value: newOnes.length, color: 'text-amber-700' },
            { label: 'Not in Monday', value: missing.length, color: 'text-red-700' },
          ].map(s => (
            <Card key={s.label} className="text-center py-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Needs action first */}
      {(needsActivation.length > 0 || needsDeactivation.length > 0) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4" /> Active Status Mismatches
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {needsDeactivation.map(r => {
              const key = `deact-${r.dbEmployee!.id}`;
              return (
                <div key={key} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-amber-200">
                  <div>
                    <span className="font-medium text-sm">{r.dbEmployee!.display_name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{r.dbEmployee!.teramind_email}</span>
                    <Badge className="ml-2 text-xs bg-green-100 text-green-800 border-green-300">Active in DB</Badge>
                    <Badge className="ml-1 text-xs bg-red-100 text-red-800 border-red-300">Not in Monday board</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving[key] || done[key]}
                    onClick={() => handleToggleActive(r.dbEmployee!, false, key)}
                    className="text-red-700 border-red-300 hover:bg-red-50"
                  >
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
                    <Badge className="ml-1 text-xs bg-green-100 text-green-800 border-green-300">Active in Monday board</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving[key] || done[key]}
                    onClick={() => handleToggleActive(r.dbEmployee!, true, key)}
                    className="text-green-700 border-green-300 hover:bg-green-50"
                  >
                    {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : done[key] ? <CheckCircle className="w-3 h-3" /> : 'Mark Active'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* New employees in Monday not in DB */}
      {newOnes.length > 0 && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" /> In Monday, Not in DB ({newOnes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {newOnes.map((r, i) => {
              const key = `new-${i}`;
              return (
                <div key={key} className="flex items-center justify-between bg-slate-50 rounded px-3 py-2 border">
                  <div>
                    <span className="font-medium text-sm">{r.mondayName}</span>
                    {r.mondayEmail && <span className="text-xs text-muted-foreground ml-2">{r.mondayEmail}</span>}
                  </div>
                  <Button
                    size="sm"
                    disabled={saving[key] || done[key]}
                    onClick={() => handleAddEmployee({ id: '', name: r.mondayName, email: r.mondayEmail, companyEmail: '' }, key)}
                  >
                    {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : done[key] ? <CheckCircle className="w-3 h-3" /> : 'Add to DB'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Full matched list */}
      {matched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" /> Matched Employees ({matched.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {matched.map(r => (
                <div key={r.dbEmployee!.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 text-sm">
                  <span className="font-medium">{r.dbEmployee!.display_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{r.dbEmployee!.teramind_email}</span>
                    <Badge className={r.dbActive ? 'bg-green-100 text-green-800 border-green-200 text-xs' : 'bg-slate-100 text-slate-600 border-slate-200 text-xs'}>
                      {r.dbActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* In DB but not Monday */}
      {missing.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-4 h-4 text-slate-400" /> In DB, Not in Monday ({missing.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {missing.map(r => (
              <div key={r.dbEmployee!.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-slate-50 text-sm">
                <span className="font-medium">{r.dbEmployee!.display_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{r.dbEmployee!.teramind_email}</span>
                  <Badge className={r.dbActive ? 'bg-amber-100 text-amber-800 border-amber-200 text-xs' : 'bg-slate-100 text-slate-600 border-slate-200 text-xs'}>
                    {r.dbActive ? 'Active (possible termination?)' : 'Inactive'}
                  </Badge>
                  {r.dbActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs text-red-700 border-red-300 hover:bg-red-50"
                      onClick={() => handleToggleActive(r.dbEmployee!, false, `miss-${r.dbEmployee!.id}`)}
                      disabled={saving[`miss-${r.dbEmployee!.id}`] || done[`miss-${r.dbEmployee!.id}`]}
                    >
                      {done[`miss-${r.dbEmployee!.id}`] ? <CheckCircle className="w-3 h-3" /> : 'Mark Inactive'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
