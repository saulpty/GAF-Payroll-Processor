import type { ContractChip } from '@/app/lib/contractChips';

// Summary chips above the Contracts table (Warm redesign, 2026-10-07). Counts come from the rows
// the global Employee / Manager / Title filters leave; clicking a chip filters the table to those
// rows and clicking it again clears it (DESIGN-SYSTEM.md, "Summary chips").

const CHIPS: { key: ContractChip; label: string; dot: string; tip: string }[] = [
  { key: 'ms14',    label: 'Milestone in 14 Days',     dot: 'bg-warm',      tip: 'Next tenure milestone is today or within 14 days' },
  { key: 'ms30',    label: 'Milestone in 30 Days',     dot: 'bg-yellow-500', tip: 'Next tenure milestone is today or within 30 days' },
  { key: 'end30',   label: 'Contract Ends in 30 Days', dot: 'bg-red-600',   tip: 'Contract end date is today or within 30 days' },
  { key: 'renewed', label: 'Renewed',                  dot: 'bg-green-600', tip: 'The Onboarding board marks the contract as renewed (Passed)' },
];

interface Props {
  employees: number;
  counts: Record<ContractChip, number>;
  active: ContractChip | null;
  onToggle: (c: ContractChip) => void;
}

export default function ContractsChips({ employees, counts, active, onToggle }: Props) {
  const chipCls = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`;
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-primary">
        {employees} {employees === 1 ? 'Employee' : 'Employees'}
      </span>
      {CHIPS.map(c => (
        <button
          key={c.key}
          type="button"
          aria-pressed={active === c.key}
          onClick={() => onToggle(c.key)}
          className={chipCls(active === c.key)}
          title={c.tip}
        >
          <span className={`w-2 h-2 rounded-full ${c.dot}`} aria-hidden="true" />
          {c.label} <strong className="font-bold">{counts[c.key]}</strong>
        </button>
      ))}
    </div>
  );
}
