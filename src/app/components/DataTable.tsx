import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import InfoTip from './InfoTip';

export type Col<T> = { key: keyof T | string; label: string; align?: 'left' | 'right' | 'center'; tip?: string; sortable?: boolean; width?: string };

export default function DataTable<T>({ columns, sortKey, sortDir, onSort, children, stickyHeader = true, dense = false, className = '' }: {
  columns: Col<T>[]; sortKey: string | null; sortDir: 'asc' | 'desc' | null; onSort: (key: string) => void;
  children: ReactNode; stickyHeader?: boolean; dense?: boolean; className?: string;
}) {
  const pad = dense ? 'px-3 py-1.5' : 'px-3 py-2';
  return (
    <div className={`overflow-auto rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      <table className="w-full text-[13px] text-slate-700">
        <thead className={`${stickyHeader ? 'sticky top-0 z-10' : ''} bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500`}>
          <tr className="border-b border-slate-200">
            {columns.map(c => {
              const k = String(c.key);
              const active = sortKey === k && sortDir !== null;
              const al = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
              const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={k} style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`${pad} font-semibold ${al} whitespace-nowrap`}>
                  {c.sortable === false ? (
                    <span>{c.label}{c.tip && <InfoTip text={c.tip} />}</span>
                  ) : (
                    <button type="button" onClick={() => onSort(k)}
                      className={`inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? 'text-slate-900' : ''}`}>
                      {c.label}{c.tip && <InfoTip text={c.tip} />}
                      <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} aria-hidden="true" />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
