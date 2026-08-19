import { useState, useCallback } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, CheckCircle2 } from 'lucide-react';
import RecordApprovalDialog, { PendingRequest, LedgerRow, DialogMode } from './RecordApprovalDialog';
import ApprovalRow from './ApprovalRow';
import loadPendingPtoRequestsAction from '@/actions/loadPendingPtoRequests';
import loadPtoApprovalsAction from '@/actions/loadPtoApprovals';

type StatusFilter = 'all' | 'pending' | 'recorded' | 'withdrawn';

const YEAR = new Date().getFullYear();

export default function ApprovalsTab() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [dialogMode,   setDialogMode]   = useState<DialogMode | null>(null);

  const [pending, pLoading, pError] = useLoadAction(
    loadPendingPtoRequestsAction,
    [] as PendingRequest[],
    { manager: null },
    { enabled: true },
  );

  const [approvals, aLoading, aError] = useLoadAction(
    loadPtoApprovalsAction,
    [] as LedgerRow[],
    { year: YEAR, employeeId: null, status: statusFilter === 'all' ? '' : statusFilter, manager: null },
    { enabled: true },
  );

  // refreshKey in deps forces reload when incremented
  const _ = refreshKey;

  const handleSaved = useCallback(() => {
    setDialogMode(null);
    setRefreshKey(k => k + 1);
  }, []);

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const pendingRows  = (pending   as PendingRequest[]) ?? [];
  const approvalRows = (approvals as LedgerRow[])      ?? [];
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"
            onClick={() => setDialogMode({ kind: 'manual' })}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add manually
          </Button>
          <Button variant="outline" size="sm" disabled={loading}
            onClick={handleRefresh}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
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
                      onClick={() => setDialogMode({ kind: 'record', request: r })}>
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
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
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
                  <th className="text-left py-2 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvalRows.map(a => (
                  <ApprovalRow
                    key={a.id}
                    row={a}
                    onEdit={setDialogMode}
                    onRefresh={handleRefresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RecordApprovalDialog
        mode={dialogMode}
        onClose={() => setDialogMode(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
