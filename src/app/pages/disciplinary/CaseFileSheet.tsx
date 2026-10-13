// Phone: one employee's case file as a full-height sheet. One row per action, oldest first (the
// order CaseFile uses on a computer). A row opens in place, one at a time, to the existing
// ActionDetail, so every button and every rule about who may press it is ActionDetail's own.
// Prop-driven: no loader, no query.
import { useEffect, useState } from 'react';
import StatusChip from '@/app/components/StatusChip';
import MobileRow from '@/app/components/mobile/MobileRow';
import MobileSheet from '@/app/components/mobile/MobileSheet';
import { fmtDate } from '@/app/lib/fmtDate';
import { caseState } from '@/app/lib/disciplinary';
import { levelInfo, stateLabel, stateTone } from './CaseFile';
import type { DisciplinaryRowData } from './DisciplinaryRow';
import ActionDetail from './ActionDetail';

interface Props {
  open: boolean;
  /** The employee whose file is shown. It stays set while the sheet closes, so the sheet never goes blank. */
  row: DisciplinaryRowData | null;
  asOf: string;
  onClose: () => void;
  onChanged: () => void;
}

export default function CaseFileSheet({ open, row, asOf, onClose, onChanged }: Props) {
  const [openId, setOpenId] = useState<number | null>(null);

  // A closed file forgets which action was open.
  useEffect(() => {
    if (!open) setOpenId(null);
  }, [open]);

  if (!row) return null;

  // Oldest first so escalation reads chronologically.
  const chronological = [...row.actions].reverse();
  const total = row.actions.length;
  const stillOpen = row.actions.filter(a => !a.deleted_at && caseState(a, asOf) !== 'closed').length;
  const subtitle = [
    row.role,
    row.branch,
    `${total} ${total === 1 ? 'action' : 'actions'}`,
    stillOpen > 0 ? `${stillOpen} open` : '',
  ].filter(Boolean).join(' · ');

  return (
    <MobileSheet open={open} onClose={onClose} size="full" title={row.displayName} subtitle={subtitle}>
      <div className="bg-white">
        {chronological.map(a => {
          const level = levelInfo(a);
          const state = caseState(a, asOf);
          const isOpen = openId === a.id;
          return (
            <MobileRow
              key={a.id}
              title={fmtDate(a.document_date) || '—'}
              right={a.deleted_at
                ? <StatusChip tone="slate">Deleted</StatusChip>
                : <StatusChip tone={stateTone(state)}>{stateLabel(state)}</StatusChip>}
              facts={
                <>
                  <StatusChip tone={level.tone}>{level.label}</StatusChip>
                  {a.final_outcome && <StatusChip tone="red">{a.final_outcome}</StatusChip>}
                </>
              }
              muted={!!a.deleted_at || state === 'closed'}
              chevron={isOpen ? 'up' : 'down'}
              expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : a.id)}
            >
              {isOpen && (
                <div className="bg-slate-50 pb-2 text-[13px]">
                  {a.scenario && (
                    <p className="px-4 pt-3 pb-1 leading-5 text-slate-700 break-words">
                      <span className="block text-[12px] font-semibold text-slate-500">Situation Type</span>
                      {a.scenario}
                    </p>
                  )}
                  <ActionDetail action={a} asOf={asOf} onChanged={onChanged} />
                </div>
              )}
            </MobileRow>
          );
        })}
      </div>
    </MobileSheet>
  );
}
