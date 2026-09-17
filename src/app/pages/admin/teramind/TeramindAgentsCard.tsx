import { useState, useMemo } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { RefreshCw, Loader2, AlertCircle, Link, Unlink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useViewer } from '@/app/context/ViewerContext';
import loadTeramindAgentsAction from '@/actions/loadTeramindAgents';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import updateTeramindAgentLinkAction from '@/actions/updateTeramindAgentLink';
import type { SyncAgentsResult } from './useTeramindPull';

type AgentRow = {
  agent_id: number;
  employee_id: number | null;
  email: string;
  name: string;
  deleted: boolean;
  linked_by: string | null;
  employee_name: string;
};
type EmpRow = { id: number; name: string; email: string };

type Props = {
  onSync: () => Promise<SyncAgentsResult>;
  syncing: boolean;
  onDone: () => void;
};

export default function TeramindAgentsCard({ onSync, syncing, onDone }: Props) {
  const { viewAs, email: viewerEmail } = useViewer();
  const [syncResult, setSyncResult] = useState<SyncAgentsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [agents, agentsLoading, , reloadAgents] = useLoadAction(loadTeramindAgentsAction, [], {});
  const [employees] = useLoadAction(loadAttendanceEmployeesAction, [], { viewAs });
  const [linkAgent] = useMutateAction(updateTeramindAgentLinkAction);

  const [pendingLinks, setPendingLinks] = useState<Record<number, number>>({});
  const [linking, setLinking] = useState<number | null>(null);

  const agentRows = useMemo(() => (agents as AgentRow[]), [agents]);
  const empRows   = useMemo(() => (employees as EmpRow[]), [employees]);

  // Count DISTINCT employees (not agents) that have at least one linked agent
  const linkedEmpIds = useMemo(
    () => new Set(agentRows.filter(a => a.employee_id != null).map(a => a.employee_id!)),
    [agentRows],
  );
  const linkedEmployeeCount = linkedEmpIds.size;

  // Employees with more than one linked agent
  const agentsPerEmployee = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of agentRows) {
      if (a.employee_id == null) continue;
      map.set(a.employee_id, (map.get(a.employee_id) ?? 0) + 1);
    }
    return map;
  }, [agentRows]);
  const multiAgentCount = useMemo(
    () => [...agentsPerEmployee.values()].filter(c => c > 1).length,
    [agentsPerEmployee],
  );

  const unlinkedEmps = useMemo(
    () => empRows.filter(e => !linkedEmpIds.has(e.id)),
    [empRows, linkedEmpIds],
  );

  const freeAgents = useMemo(
    () => agentRows.filter(a => !a.deleted && a.employee_id == null),
    [agentRows],
  );

  const humanLinked = useMemo(
    () => agentRows.filter(a => a.employee_id != null && a.linked_by && a.linked_by !== 'auto'),
    [agentRows],
  );

  const handleSync = async () => {
    setError(null);
    try {
      const result = await onSync();
      setSyncResult(result);
      await reloadAgents();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleLink = async (empId: number) => {
    const agentId = pendingLinks[empId];
    if (!agentId) return;
    setLinking(empId);
    try {
      await linkAgent({ agent_id: agentId, employee_id: empId, linked_by: viewerEmail });
      await reloadAgents();
      setPendingLinks(p => { const n = { ...p }; delete n[empId]; return n; });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async (agentId: number) => {
    setLinking(agentId);
    try {
      await linkAgent({ agent_id: agentId, employee_id: '', linked_by: '' });
      await reloadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinking(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Sync Teramind Roster</CardTitle>
          {syncResult && (
            <Badge variant="outline" className="text-[10px]">
              {syncResult.agents} agents · {syncResult.linked} linked
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {/* Counters */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2 border">
            <div className="text-lg font-bold text-green-700">{agentsLoading ? '—' : linkedEmployeeCount}</div>
            <div className="text-[10px] text-muted-foreground">Linked Employees</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 border">
            <div className="text-lg font-bold text-amber-600">{agentsLoading ? '—' : unlinkedEmps.length}</div>
            <div className="text-[10px] text-muted-foreground">Employees With No Agent</div>
          </div>
        </div>

        {/* Multi-agent note */}
        {!agentsLoading && multiAgentCount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {multiAgentCount} employee{multiAgentCount !== 1 ? 's' : ''} have more than one Teramind account — all of their accounts are linked.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {/* Sync button */}
        <Button size="sm" className="w-full" onClick={handleSync} disabled={syncing}>
          {syncing
            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          {syncing ? 'Syncing…' : 'Sync Teramind Roster'}
        </Button>

        {/* Unlinked employees: manual link */}
        {unlinkedEmps.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-slate-600">Employees With No Linked Agent</p>
            {unlinkedEmps.map(emp => (
              <div key={emp.id} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 truncate font-medium text-slate-700">{emp.name}</span>
                <select
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs bg-white"
                  value={pendingLinks[emp.id] ?? ''}
                  onChange={e => setPendingLinks(p => ({ ...p, [emp.id]: Number(e.target.value) }))}
                >
                  <option value="">— pick agent —</option>
                  {freeAgents.map(a => (
                    <option key={a.agent_id} value={a.agent_id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
                <Button
                  size="sm" variant="outline" className="shrink-0 px-2 h-7"
                  disabled={!pendingLinks[emp.id] || linking === emp.id}
                  onClick={() => handleLink(emp.id)}
                >
                  {linking === emp.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Link className="w-3 h-3 mr-1" />}
                  Link
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Human-linked: allow unlink */}
        {humanLinked.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-slate-600">Manually Linked — Unlink</p>
            {humanLinked.map(a => (
              <div key={a.agent_id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate text-slate-700">{a.employee_name} ↔ {a.name}</span>
                <Button
                  size="sm" variant="outline"
                  className="shrink-0 px-2 h-7 text-red-600 hover:text-red-700"
                  disabled={linking === a.agent_id}
                  onClick={() => handleUnlink(a.agent_id)}
                >
                  {linking === a.agent_id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Unlink className="w-3 h-3 mr-1" />}
                  Unlink
                </Button>
              </div>
            ))}
          </div>
        )}

      </CardContent>
    </Card>
  );
}
