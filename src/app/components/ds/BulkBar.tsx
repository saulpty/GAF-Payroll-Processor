import type { ReactNode } from 'react';

// Bulk actions rule (docs/uib/DESIGN.md): checkbox column on the left, bar
// appears only for 2+ rows, floats bottom-centre. Never for a single row —
// that's edited inline.
export function BulkBar({
  count,
  children,
  onClear,
}: {
  count: number;
  children: ReactNode;
  onClear: () => void;
}) {
  if (count < 2) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-[12px] text-white shadow-xl"
    >
      <span className="font-medium">{count} Selected</span>
      <span className="h-4 w-px bg-white/25" aria-hidden="true" />
      <div className="flex items-center gap-2">{children}</div>
      <span className="h-4 w-px bg-white/25" aria-hidden="true" />
      <button
        type="button"
        onClick={onClear}
        className="rounded-full px-2 py-1 font-medium text-white/80 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
      >
        Clear
      </button>
    </div>
  );
}

export function BulkPrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-warm px-3 py-1 font-semibold text-warm-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function BulkButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/25 px-3 py-1 text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring disabled:opacity-50"
    >
      {children}
    </button>
  );
}
