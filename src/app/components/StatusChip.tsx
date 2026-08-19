import type { ReactNode } from 'react';

export type ChipTone = 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'blue';

const TONES: Record<ChipTone, string> = {
  green:  'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber:  'bg-amber-50 text-amber-700 ring-amber-600/15',
  red:    'bg-red-50 text-red-700 ring-red-600/15',
  slate:  'bg-slate-100 text-slate-600 ring-slate-500/10',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  blue:   'bg-sky-50 text-sky-700 ring-sky-600/15',
};

export default function StatusChip({ tone, icon, children, strike }: { tone: ChipTone; icon?: ReactNode; children: ReactNode; strike?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]} ${strike ? 'line-through opacity-70' : ''}`}>
      {icon}{children}
    </span>
  );
}
