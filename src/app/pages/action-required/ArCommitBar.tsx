import { GitCommit, Loader2, RotateCcw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The blue selection/commit bar and the "N unsaved · Discard all" button. Split out of ActionRequired.tsx, AR-1. */
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
      {/* ── Sticky commit bar ──────────────────────────────── */}
      <div className={`shrink-0 transition-all duration-200 ${someSelected ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
        <div className="flex items-center gap-3 bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-md">
          <GitCommit className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">{selectedCount} row{selectedCount !== 1 ? 's' : ''} selected</span>
          <span className="text-blue-300 text-xs">— shift-click to range-select</span>
          {selectedSize > 1 && (
            <span className="text-blue-200 text-xs font-medium">
              Editing any Event, Impact or Doc field will apply to all {selectedSize} selected rows.
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onDeselectAll}
              className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white transition-colors px-2 py-1 rounded hover:bg-blue-600">
              <X className="w-3.5 h-3.5" />Deselect all
            </button>
            <Button size="sm"
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold h-8"
              disabled={bulkSaving}
              onClick={onCommit}>
              {bulkSaving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Committing…</>
                : <><Send className="w-3.5 h-3.5 mr-1.5" />Commit {selectedCount} to GREEN</>}
            </Button>
          </div>
        </div>
      </div>

      {dirtyCount > 0 && (
        <div className="shrink-0 flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50" onClick={onDiscardAll}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />{dirtyCount} unsaved · Discard all
          </Button>
        </div>
      )}
    </>
  );
}
