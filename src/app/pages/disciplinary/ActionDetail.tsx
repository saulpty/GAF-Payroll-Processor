// ActionDetail — full detail view for one disciplinary action.
// Prop-driven, no useLoadAction, no useGlobalFilters. Reusable by Employee 360.
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import StatusChip from '@/app/components/StatusChip';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/app/lib/fmtDate';
import { caseState } from '@/app/lib/disciplinary';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import CloseCaseDialog from './CloseCaseDialog';
import updateDisciplinaryActionReopenedAction from '@/actions/updateDisciplinaryActionReopened';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenCase] = useMutateAction(updateDisciplinaryActionReopenedAction);

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

  return (
    <div className="bg-white border border-slate-200 rounded-lg mx-2 my-1 overflow-hidden">
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

      {/* Footer */}
      {state === 'closed' ? (
        <div className="px-4 py-2.5 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-emerald-700">
            Closed {fmtDate(action.closed_at)} by {action.closed_by}
            {action.closure_note && (
              <span className="text-emerald-600 ml-1">— {action.closure_note}</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleReopen}
            disabled={reopening}
            className="text-[12px] text-emerald-700 underline underline-offset-2 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded disabled:opacity-50 shrink-0"
          >
            {reopening
              ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
              : 'Reopen'}
          </button>
        </div>
      ) : (
        <div className="px-4 py-2.5 border-t border-slate-100 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            Close case
          </Button>
        </div>
      )}

      <CloseCaseDialog
        action={dialogOpen ? action : null}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); onChanged(); }}
      />
    </div>
  );
}
