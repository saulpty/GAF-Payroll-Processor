import type { WhyChip } from '@/app/lib/activityDays';

const TONE: Record<WhyChip['tone'], string> = {
  blue:  'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  gray:  'bg-slate-100 text-slate-600 border-slate-200',
};

export default function WhyChipBadge({ chip }: { chip: WhyChip }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TONE[chip.tone]}`}>
      {chip.label}
    </span>
  );
}
