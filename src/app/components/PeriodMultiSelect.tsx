import { useRef, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { fmtDate } from '@/app/lib/fmtDate';

type Period = {
  period_name: string;
  start_date: string;
  end_date: string;
};

type Props = {
  periods: Period[];
  selected: string[];
  onChange: (names: string[]) => void;
};

export default function PeriodMultiSelect({ periods, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter(n => n !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const label =
    selected.length === 0
      ? 'Choose…'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} periods`;

  const btnCls =
    'h-8 px-2.5 text-[13px] border border-slate-200 rounded-lg bg-white flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-colors min-w-[140px]';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={btnCls}
      >
        <span className="flex-1 text-left truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto min-w-[260px]">
          {periods.length === 0 && (
            <div className="px-3 py-2 text-[13px] text-slate-400">No processed periods</div>
          )}
          {periods.map(p => {
            const checked = selected.includes(p.period_name);
            return (
              <label
                key={p.period_name}
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.period_name)}
                  className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer shrink-0"
                />
                <span className="font-medium text-[13px] text-slate-800 flex-1">{p.period_name}</span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                </span>
              </label>
            );
          })}
          {periods.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-1.5">
              <button
                type="button"
                onClick={() => {
                  if (periods[0]) onChange([periods[0].period_name]);
                  setOpen(false);
                }}
                className="text-[12px] text-slate-500 hover:text-emerald-700 transition-colors"
              >
                Newest only
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
