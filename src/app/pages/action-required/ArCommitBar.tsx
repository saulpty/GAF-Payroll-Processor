import { Loader2, RotateCcw, Send } from 'lucide-react';
import { BulkBar, BulkPrimaryButton } from '@/app/components/ds/BulkBar';

/**
 * The bulk bar (AR-4: ds/BulkBar, floating, only for 2+ rows) and the
 * "N unsaved · Discard All" button. Same props as before AR-4.
 */
export function ArCommitBar({ someSelected, selectedCount, selectedSize, bulkSaving, dirtyCount, onDeselectAll, onCommit, onDiscardAll }: {
  someSelected: boolean;
  selectedCount: number;
  selectedSize: number;
  bulkSaving: boolean;
  dirtyCount: number;
  onDeselectAll: () => void;
  onCommit: () => void;
  onDiscardAll: () => void;
}) {
  return (
    <>
      <BulkBar count={someSelected ? selectedCount : 0} onClear={onDeselectAll}>
        {selectedSize > 1 && (
          <span className="hidden text-[12px] text-white/70 xl:inline">Event, Impact and Doc changes apply to all {selectedSize}</span>
        )}
        <BulkPrimaryButton onClick={onCommit} disabled={bulkSaving}>
          <span className="inline-flex items-center gap-1.5">
            {bulkSaving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Committing…</>
              : <><Send className="w-3.5 h-3.5" />Commit {selectedCount} to Green</>}
          </span>
        </BulkPrimaryButton>
      </BulkBar>

      {dirtyCount > 0 && (
        <div className="shrink-0 flex items-center gap-2">
          <button type="button" onClick={onDiscardAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
            <RotateCcw className="w-3.5 h-3.5" />{dirtyCount} Unsaved · Discard All
          </button>
        </div>
      )}
    </>
  );
}
