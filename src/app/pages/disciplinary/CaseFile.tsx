import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import StatusChip from '@/app/components/StatusChip';
import type { ChipTone } from '@/app/components/StatusChip';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/app/lib/fmtDate';
import { caseState, levelRank } from '@/app/lib/disciplinary';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import CloseCaseDialog from './CloseCaseDialog';
import updateDisciplinaryActionReopenedAction from '@/actions/updateDisciplinaryActionReopened';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  actions: DisciplinaryRow[];   // one employee's actions, newest first
  asOf: string;
  onChanged: () => void;        // called after a close or reopen succeeds
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LevelInfo = { label: string; tone: ChipTone };

function levelInfo(row: DisciplinaryRow): LevelInfo {
  const rank = levelRank(row.warning_level);
  switch (rank) {
    case 3:  return { label: 'Final Written Warning',    tone: 'red' };
    case 2:  return { label: 'Second Written Warning',   tone: 'amber' };
    case 1:  return { label: 'First Written Warning',    tone: 'amber' };
    case 0:  return { label: 'Verbal Warning',           tone: 'slate' };
    default: return { label: row.warning_level ?? '—',   tone: 'slate' };
  }
}

function headerSummary(actions: DisciplinaryRow[], asOf: string) {
  const highest = actions.reduce(
    (best, a) => Math.max(best, levelRank(a.warning_level)),
    -1,
  );
  const allClosed = actions.every(a => caseState(a, asOf) === 'closed');
  const openRevDates = actions
    .filter(a => !a.closed_at && a.revaluation_date)
    .map(a => a.revaluation_date!.slice(0, 10))
    .sort();
  const nextReval = openRevDates.find(d => d >= asOf.slice(0, 10)) ?? null;
  const latest = actions[0] ?? null; // actions are newest-first

  const highestLabel =
    highest === 3 ? 'Final Written Warning' :
    highest === 2 ? 'Second Written Warning' :
    highest === 1 ? 'First Written Warning' :
    highest === 0 ? 'Verbal Warning' :
    actions[0]?.warning_level ?? '—';

  const highestTone: ChipTone =
    highest === 3 ? 'red' :
    highest >= 1  ? 'amber' :
    'slate';

  return { highest, highestLabel, highestTone, allClosed, nextReval, latest };
}

// ---------------------------------------------------------------------------
// Escalation dots (larger version for the header strip)
// ---------------------------------------------------------------------------

function EscalationDots({ rank, size = 'md' }: { rank: number; size?: 'sm' | 'md' }) {
  const total = 4;
  const filled = rank + 1;
  const tone = rank === 3 ? 'red' : rank >= 1 ? 'amber' : 'slate';
  const filledClass =
    tone === 'red'   ? 'bg-red-500'   :
    tone === 'amber' ? 'bg-amber-400' :
                       'bg-slate-400';
  const dotSize   = size === 'md' ? 'w-3 h-3'  : 'w-2 h-2';
  const barWidth  = size === 'md' ? 'w-4'       : 'w-2.5';
  const levelLabels = ['Verbal', 'First Written', 'Second Written', 'Final Written'];
  const ariaLabel = rank >= 0
    ? `Escalation: ${levelLabels[rank]}, ${filled} of ${total}`
    : 'Escalation: none';

  return (
    <div className="flex items-center gap-0.5" aria-label={ariaLabel}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && (
            <span
              className={`inline-block ${barWidth} h-px mx-0.5 ${i < filled ? filledClass : 'bg-slate-200'}`}
            />
          )}
          <span
            className={`inline-block ${dotSize} rounded-full border ${
              i < filled
                ? `${filledClass} border-transparent`
                : 'bg-white border-slate-200'
            }`}
          />
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fact field — omit when empty
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Single action card
// ---------------------------------------------------------------------------

interface ActionCardProps {
  action: DisciplinaryRow;
  asOf: string;
  onCloseRequest: (a: DisciplinaryRow) => void;
  onReopen: (a: DisciplinaryRow) => void;
  reopeningId: number | null;
}

function ActionCard({ action, asOf, onCloseRequest, onReopen, reopeningId }: ActionCardProps) {
  const state = caseState(action, asOf);
  const lInfo = levelInfo(action);
  const isReopening = reopeningId === action.id;

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

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusChip tone={lInfo.tone}>{lInfo.label}</StatusChip>
          {action.final_outcome && (
            <StatusChip tone="red">{action.final_outcome}</StatusChip>
          )}
          {action.scenario && (
            <span className="text-[13px] text-slate-500">{action.scenario}</span>
          )}
        </div>
        <span className="font-mono text-xs text-slate-400 shrink-0">{action.ref}</span>
      </div>

      {/* Facts */}
      <div className="px-4 py-4 space-y-4">
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
            onClick={() => onReopen(action)}
            disabled={isReopening}
            className="text-[12px] text-emerald-700 underline underline-offset-2 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded disabled:opacity-50 shrink-0"
          >
            {isReopening
              ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
              : 'Reopen'}
          </button>
        </div>
      ) : (
        <div className="px-4 py-2.5 border-t border-slate-100 flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCloseRequest(action)}
          >
            Close case
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CaseFile
// ---------------------------------------------------------------------------

export default function CaseFile({ actions, asOf, onChanged }: Props) {
  const [dialogAction, setDialogAction] = useState<DisciplinaryRow | null>(null);
  const [reopeningId, setReopeningId] = useState<number | null>(null);

  const [reopenCase] = useMutateAction(updateDisciplinaryActionReopenedAction);

  const summary = headerSummary(actions, asOf);

  // Oldest first for the narrative view
  const chronological = [...actions].reverse();

  async function handleReopen(a: DisciplinaryRow) {
    setReopeningId(a.id);
    try {
      await reopenCase({ id: a.id });
      onChanged();
    } finally {
      setReopeningId(null);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4 bg-slate-50">
      {/* Header strip */}
      <div className="flex items-center gap-6 flex-wrap rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm text-[12px]">
        <Stat label="Actions">{actions.length}</Stat>
        <Stat label="Highest level">
          <StatusChip tone={summary.highestTone}>{summary.highestLabel}</StatusChip>
        </Stat>
        <Stat label="Escalation">
          <EscalationDots rank={summary.highest} size="md" />
        </Stat>
        {summary.nextReval && (
          <Stat label="Next re-evaluation">
            <span className="tabular-nums">{fmtDate(summary.nextReval)}</span>
          </Stat>
        )}
        {summary.latest && (
          <Stat label="Last action">
            <span className="tabular-nums">{fmtDate(summary.latest.document_date)}</span>
          </Stat>
        )}
        {summary.allClosed && (
          <StatusChip tone="green">All closed</StatusChip>
        )}
      </div>

      {/* Action cards — oldest first */}
      {chronological.map(a => (
        <ActionCard
          key={a.id}
          action={a}
          asOf={asOf}
          onCloseRequest={setDialogAction}
          onReopen={handleReopen}
          reopeningId={reopeningId}
        />
      ))}

      {/* Close case dialog */}
      <CloseCaseDialog
        action={dialogAction}
        onClose={() => setDialogAction(null)}
        onSaved={() => { setDialogAction(null); onChanged(); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat helper — small label + value pair
// ---------------------------------------------------------------------------

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
        {label}
      </span>
      <div className="text-[13px] text-slate-800 font-medium">{children}</div>
    </div>
  );
}
