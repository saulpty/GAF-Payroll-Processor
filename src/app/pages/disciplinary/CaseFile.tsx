// CaseFile — compact one-line-per-action table for one employee.
// Prop-driven, no useLoadAction, no useGlobalFilters. Reusable by Employee 360.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import StatusChip from '@/app/components/StatusChip';
import type { ChipTone } from '@/app/components/StatusChip';
import { fmtDate } from '@/app/lib/fmtDate';
import { caseState, levelRank } from '@/app/lib/disciplinary';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import ActionDetail from './ActionDetail';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  actions: DisciplinaryRow[];   // one employee's actions, newest first
  asOf: string;
  onChanged: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type LevelInfo = { label: string; tone: ChipTone };

function levelInfo(row: DisciplinaryRow): LevelInfo {
  const rank = levelRank(row.warning_level);
  switch (rank) {
    case 3:  return { label: 'Final Written',  tone: 'red' };
    case 2:  return { label: 'Second Written', tone: 'amber' };
    case 1:  return { label: 'First Written',  tone: 'amber' };
    case 0:  return { label: 'Verbal',         tone: 'slate' };
    default: return { label: row.warning_level ?? '—', tone: 'slate' };
  }
}

function stateTone(s: ReturnType<typeof caseState>): ChipTone {
  if (s === 'closed')  return 'green';
  if (s === 'outcome') return 'red';
  if (s === 'overdue') return 'red';
  return 'amber';
}

function stateLabel(s: ReturnType<typeof caseState>): string {
  if (s === 'closed')  return 'Closed';
  if (s === 'outcome') return 'Outcome';
  if (s === 'overdue') return 'Overdue';
  return 'Open';
}

// ---------------------------------------------------------------------------
// CaseFile
// ---------------------------------------------------------------------------

export default function CaseFile({ actions, asOf, onChanged }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Oldest first so escalation reads chronologically
  const chronological = [...actions].reverse();

  function toggleAction(id: number) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  return (
    <div className="bg-slate-50 border-t border-slate-100">
      <table className="w-full text-[13px] border-collapse">
        <tbody>
          {chronological.map(a => {
            const lInfo = levelInfo(a);
            const state = caseState(a, asOf);
            const isOpen = expandedId === a.id;
            const truncated = a.q_happened
              ? a.q_happened.length > 110
                ? a.q_happened.slice(0, 110) + '…'
                : a.q_happened
              : '—';

            return (
              <>
                <tr
                  key={a.id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-100/60 transition-colors cursor-pointer select-none"
                  onClick={() => toggleAction(a.id)}
                >
                  {/* Date */}
                  <td className="pl-6 pr-3 py-2 whitespace-nowrap text-slate-500 tabular-nums w-24">
                    {fmtDate(a.document_date)}
                  </td>

                  {/* Level + outcome chip */}
                  <td className="px-3 py-2 whitespace-nowrap w-40">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusChip tone={lInfo.tone}>{lInfo.label}</StatusChip>
                      {a.final_outcome && (
                        <StatusChip tone="red">{a.final_outcome}</StatusChip>
                      )}
                    </div>
                  </td>

                  {/* Scenario */}
                  <td className="px-3 py-2 text-slate-500 w-44 whitespace-nowrap overflow-hidden">
                    <span className="truncate block max-w-[160px]">{a.scenario ?? '—'}</span>
                  </td>

                  {/* What happened — truncated */}
                  <td className="px-3 py-2 text-slate-500 min-w-0 max-w-0">
                    <span className="block truncate">{truncated}</span>
                  </td>

                  {/* Manager */}
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500 w-36 hidden lg:table-cell">
                    {a.manager_name ?? '—'}
                  </td>

                  {/* Re-evaluation */}
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500 tabular-nums w-24 hidden xl:table-cell">
                    {fmtDate(a.revaluation_date) ?? '—'}
                  </td>

                  {/* Status chip */}
                  <td className="px-3 py-2 whitespace-nowrap w-24">
                    <StatusChip tone={stateTone(state)}>{stateLabel(state)}</StatusChip>
                  </td>

                  {/* Chevron */}
                  <td className="pr-4 py-2 w-8 text-right">
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </td>
                </tr>

                {/* Expanded detail row */}
                {isOpen && (
                  <tr key={`${a.id}-detail`} className="bg-slate-50">
                    <td colSpan={8} className="p-0">
                      <ActionDetail
                        action={a}
                        asOf={asOf}
                        onChanged={onChanged}
                      />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
