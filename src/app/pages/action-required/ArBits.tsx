import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortDir, SortKey } from './arTypes';

export function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30 inline ml-0.5" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5 text-blue-600" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5 text-blue-600" />;
}

export function Th({ col, label, className = '', sortKey, sortDir, onSort }: {
  col: SortKey; label: string; className?: string;
  sortKey: SortKey; sortDir: SortDir; onSort: (col: SortKey) => void;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r last:border-r-0 cursor-pointer select-none hover:bg-slate-200 transition-colors ${className}`}
      onClick={() => col && onSort(col)}
    >
      {label}{col && <SortIcon col={col as string} sortKey={sortKey} sortDir={sortDir} />}
    </th>
  );
}

// Visual select that glows when it will broadcast to multiple rows
export function BroadcastSelect({ value, options, placeholder, broadcasting, onChange }: {
  value: string;
  options: string[];
  placeholder: string;
  broadcasting: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        className={`w-full border rounded px-1.5 py-1 text-xs bg-white transition-colors ${
          broadcasting
            ? 'border-blue-400 ring-1 ring-blue-300 bg-blue-50'
            : ''
        }`}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {broadcasting && (
        <span
          title={`Will apply to all selected rows`}
          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border border-white text-white flex items-center justify-center text-[8px] font-bold leading-none"
        >
          ↗
        </span>
      )}
    </div>
  );
}
