import { useState, useCallback } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, CheckCircle2, Clock, XCircle } from 'lucide-react';
import RecordApprovalDialog, { PendingRequest } from './RecordApprovalDialog';
import loadPendingPtoRequestsAction from '@/actions/loadPendingPtoRequests';
import loadPtoApprovalsAction from '@/actions/loadPtoApprovals';

type StatusFilter = 'all' | 'pending' | 'recorded' | 'withdrawn';

interface Approval {
  id: number;
  employee_id: number | null;
  display_name: string | null;
  leave_on: string | null;
  return_on: string | null;
  total_days: string | null;
  status: string;
  source: string;
  gaf_comments: string | null;
  submitted_by: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
  monday_item_id: number | null;
}

const YEAR = new Date().getFullYear();

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock        },
  recorded:  { label: 'Recorded',  cls: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  withdrawn: { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle      },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['pending'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export default function ApprovalsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [dialogRow,    setDialogRow]    = useState<PendingRequest | null>(null);

  const [pending, pLoading, pError] = useLoadAction(
    loadPendingPtoRequestsAction,
    [] as PendingRequest[],
    {},
    { enabled: true },
  );

  const [approvals, aLoading, aError] = useLoadAction(
    loadPtoApprovalsAction,
    [] as Approval[],
    { year: YEAR, employeeId: null, status: statusFilter === 'all' ? '' : statusFilter },
    { enabled: true },
  );

  // refreshKey in deps array forces reload when incremented
  const _ = refreshKey; // referenced to avoid lint warning

  const handleSaved = useCallback(() => {
    setDialogRow(null);
    setRefreshKey(k => k + 1);
  }, []);

  const pendingRows  = (pending  as PendingRequest[]) ?? [];
  const approvalRows = (approvals as Approval[])       ?? [];

  const loading = pLoading || aLoading;
  const error   = pError ?? aError;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">PTO Approvals</h2>
          <p className="text-xs text-slate-500 mt-0.5">{YEAR} · {approvalRows.length} recorded</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading}
          onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error.message}
        </p>
      )}

      {/* Pending queue */}
      {pendingRows.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Pending from Monday ({pendingRows.length})
          </h3>
          <div className="space-y-2">
            {pendingRows.map((r, i) => {
              const unmatched = !r.employee_id;
              return (
                <Card key={r.monday_item_id ?? i}
                  className={`border ${unmatched ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {r.display_name ?? r.employee_name_raw}
                        </span>
                        {unmatched && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 border">
                            Unmatched
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(r.leave_on ?? '').slice(0, 10)} → {(r.return_on ?? '').slice(0, 10)}
                        {r.total_days ? ` · ${Number(r.total_days)} days` : ''}
                        {r.reason ? ` · ${r.reason}` : ''}
                      </p>
                    </div>
                    <Button size="sm" className="ml-3 shrink-0"
                      disabled={unmatched}
                      onClick={() => setDialogRow(r)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Record
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {pendingRows.length === 0 && !pLoading && (
        <Card className="border-dashed border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-2 py-3 px-4 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            All Monday requests have been recorded.
          </CardContent>
        </Card>
      )}

      {/* Status filter chips */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-xs text-slate-500 mr-1">Filter:</span>
          {(['all', 'recorded', 'pending', 'withdrawn'] as StatusFilter[]).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>
              {s === 'all' ? 'All' : STATUS_CFG[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Approvals ledger */}
        {aLoading ? (
          <p className="text-xs text-slate-500 py-4 text-center">Loading approvals…</p>
        ) : approvalRows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-center py-10 text-sm text-slate-400">
              No approvals found.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left py-2 px-3 font-medium">Employee</th>
                  <th className="text-left py-2 px-3 font-medium">Leave on</th>
                  <th className="text-left py-2 px-3 font-medium">Return on</th>
                  <th className="text-right py-2 px-3 font-medium">Days</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Source</th>
                  <th className="text-left py-2 px-3 font-medium">Recorded by</th>
                  <th className="text-left py-2 px-3 font-medium">Comments</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map(a => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-3 font-medium text-slate-800">{a.display_name ?? '—'}</td>
                    <td className="py-2 px-3 text-slate-600">{(a.leave_on ?? '').slice(0, 10)}</td>
                    <td className="py-2 px-3 text-slate-600">{(a.return_on ?? '').slice(0, 10)}</td>
                    <td className="py-2 px-3 text-right text-slate-700">{a.total_days ?? '—'}</td>
                    <td className="py-2 px-3"><StatusBadge status={a.status} /></td>
                    <td className="py-2 px-3 text-slate-500 capitalize">{a.source}</td>
                    <td className="py-2 px-3 text-slate-500">{a.recorded_by ?? '—'}</td>
                    <td className="py-2 px-3 text-slate-400 max-w-[160px] truncate">{a.gaf_comments ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordApprovalDialog
        request={dialogRow}
        onClose={() => setDialogRow(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
