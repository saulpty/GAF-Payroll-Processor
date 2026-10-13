import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  /** Line 1, left: the name. Wraps onto a second line; never cut off. */
  title: ReactNode;
  /** Small line under the title (role, position). */
  sub?: ReactNode;
  /** Line 1, pinned right: one status pill or one headline number. */
  right?: ReactNode;
  /** Line 2: up to three facts. */
  facts?: ReactNode;
  /** Whole-row wash for a flagged row, as on the computer. */
  tone?: 'none' | 'green' | 'yellow' | 'red';
  /** Day off, inactive, closed: muted text (never see-through). */
  muted?: boolean;
  /** down / up = opens in place (reading only). right = opens a sheet. */
  chevron?: 'none' | 'down' | 'up' | 'right';
  /** When given, the row is a real button. */
  onClick?: () => void;
  /** For rows that open in place. */
  expanded?: boolean;
  /** Name for screen readers when the title is not plain text. */
  label?: string;
  /** The opened-in-place detail, shown under the row. */
  children?: ReactNode;
};

const TONE = {
  none: 'bg-white',
  green: 'bg-status-green-tint',
  yellow: 'bg-status-yellow-tint',
  red: 'bg-status-red-tint',
} as const;

const CHEVRON = { down: ChevronDown, up: ChevronUp, right: ChevronRight } as const;

/** One row of a phone list: flat, full width, a hairline under it. See DESIGN.md, "Phone". */
export default function MobileRow({
  title, sub, right, facts, tone = 'none', muted = false, chevron = 'none', onClick, expanded, label, children,
}: Props) {
  const Icon = chevron === 'none' ? null : CHEVRON[chevron];
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={cn('block text-[14px] font-semibold leading-5 break-words', muted ? 'text-slate-500' : 'text-slate-900')}>
            {title}
          </span>
          {sub && <span className="block text-[12px] leading-4 text-slate-500 break-words">{sub}</span>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {right}
          {Icon && <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />}
        </span>
      </span>
      {facts && (
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-slate-500 tabular-nums">
          {facts}
        </span>
      )}
    </>
  );
  const box = cn('block w-full min-h-[60px] px-4 py-3 text-left', TONE[tone]);
  return (
    <div className="border-b border-slate-200">
      {onClick ? (
        <button
          type="button" onClick={onClick} aria-expanded={expanded} aria-label={label}
          className={cn(box, 'active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warm-ring')}
        >
          {body}
        </button>
      ) : (
        <div className={box}>{body}</div>
      )}
      {children}
    </div>
  );
}
