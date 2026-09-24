// ActionDetail — full detail view for one disciplinary action.
// Prop-driven; its only load is useDisciplinaryAdmin. Reusable by Employee 360.
import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, Loader2, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import StatusChip from '@/app/components/StatusChip';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/app/lib/fmtDate';
import { caseState } from '@/app/lib/disciplinary';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import CloseCaseDialog from './CloseCaseDialog';
import DeleteActionDialog from './DeleteActionDialog';
import updateDisciplinaryActionReopenedAction from '@/actions/updateDisciplinaryActionReopened';
import updateDisciplinaryActionRestoredAction from '@/actions/updateDisciplinaryActionRestored';
import { useDisciplinaryAdmin } from './useDisciplinaryAdmin';
import ActionPdfBar from './ActionPdfBar';
import EditActionForm from './EditActionForm';

interface Props {
  action: DisciplinaryRow;
  asOf: string;
  onChanged: () => void;
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
        {label}
      </div>
      <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function ActionDetail({ action, asOf, onChanged }: Props) {
  const { isDisciplinaryAdmin } = useDisciplinaryAdmin();
  const savedUnreloaded = useRef(false);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  useEffect(() => () => { if (savedUnreloaded.current) onChangedRef.current(); }, []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reopenCase] = useMutateAction(updateDisciplinaryActionReopenedAction);
  const [restoreAction] = useMutateAction(updateDisciplinaryActionRestoredAction);

  const state = caseState(action, asOf);

  const evidenceList = Array.isArray(action.evidence_types) && action.evidence_types.length > 0
    ? action.evidence_types.join(', ')
    : null;

  const metaParts: string[] = [];
  if (evidenceList)                 metaParts.push(`Evidence: ${evidenceList}`);
  if (action.evidence_description)  metaParts.push(action.evidence_description);
  if (action.prior_warnings)        metaParts.push(`Prior warnings: ${action.prior_warnings}`);
  if (action.revaluation_date)      metaParts.push(`Re-eval: ${fmtDate(action.revaluation_date)}`);
  metaParts.push(action.signature_drawn ? 'Signed' : 'Not signed');
  if (action.manager_name)          metaParts.push(`Filed by: ${action.manager_name}${action.manager_email ? ` <${action.manager_email}>` : ''}`);
  metaParts.push(`Filed ${fmtDate(action.document_date)}`);
  metaParts.push(`Ref: ${action.ref}`);

  async function handleReopen() {
    setReopening(true);
    try {
      await reopenCase({ id: action.id });
      onChanged();
    } finally {
      setReopening(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      await restoreAction({ id: action.id });
      onChanged();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg mx-2 my-1 overflow-hidden">
      {/* Status bar */}
      {action.deleted_at ? (
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-slate-700">
            Deleted {fmtDate(action.deleted_at.slice(0, 10))} by {action.deleted_by}
            {action.deletion_note && (
              <span className="text-slate-500 ml-1">— {action.deletion_note}</span>
            )}
          </span>
          {isDisciplinaryAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleRestore} disabled={restoring} className="h-8 text-[12px]">
                {restoring
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                Restore
              </Button>
            </div>
          )}
        </div>
      ) : state === 'closed' ? (
        <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-emerald-700">
            Closed {fmtDate(action.closed_at)} by {action.closed_by}
            {action.closure_note && (
              <span className="text-emerald-600 ml-1">— {action.closure_note}</span>
            )}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReopen}
              disabled={reopening}
              className="text-[12px] text-emerald-700 underline underline-offset-2 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded disabled:opacity-50"
            >
              {reopening
                ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                : 'Reopen'}
            </button>
            {isDisciplinaryAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8 text-[12px] text-red-700 border-red-200 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] font-medium text-rose-800">This Case Is Open</span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-[#BE123C] hover:bg-[#9F1239] text-white h-9 px-4 text-[13px] font-semibold shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Close Case
            </Button>
            {isDisciplinaryAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8 text-[12px] text-red-700 border-red-200 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <ActionPdfBar action={action}>
        {isDisciplinaryAdmin && !action.deleted_at && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-8 text-[12px]">
            <Pencil className="w-3.5 h-3.5 mr-1" />Edit
          </Button>
        )}
      </ActionPdfBar>

      {editing ? (
        <EditActionForm
          action={action}
          onCancel={() => setEditing(false)}
          onSaved={() => { savedUnreloaded.current = true; }}
          onDone={() => { savedUnreloaded.current = false; setEditing(false); onChanged(); }}
        />
      ) : (
        <>
          {/* Facts */}
          <div className="px-4 py-4 space-y-3">
            <Fact label="What was expected" value={action.q_expected} />
            <Fact label="What happened"     value={action.q_happened} />
            <Fact label="When"              value={action.q_when} />
            <Fact label="Impact"            value={action.q_impact} />
            <Fact label="Expectations set"  value={action.expectations} />
            <Fact label="Consequences"      value={action.consequences} />
          </div>

          {/* Meta line */}
          {metaParts.length > 0 && (
            <div className="px-4 py-2.5 border-t border-dashed border-slate-200 text-[11px] text-slate-400 leading-relaxed">
              {metaParts.join(' · ')}
            </div>
          )}
        </>
      )}

      <CloseCaseDialog
        action={dialogOpen ? action : null}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); onChanged(); }}
      />
      <DeleteActionDialog
        action={deleteOpen ? action : null}
        onClose={() => setDeleteOpen(false)}
        onSaved={() => { setDeleteOpen(false); onChanged(); }}
      />
    </div>
  );
}
