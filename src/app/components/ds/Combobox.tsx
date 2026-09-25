import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { filterOptions, nextIndex } from '@/app/components/ds/comboboxFilter';

// Dropdowns rule (docs/uib/DESIGN.md): searchable when > 7 options, empty
// shows "—", a × clears back to empty, no "None" / "— pick —" option.
export function Combobox({
  value,
  options,
  onChange,
  placeholder = '—',
  ariaLabel,
  invalid = false,
  flashKey,
  className = '',
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
  flashKey?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchable = options.length > 7;

  const filtered = useMemo(
    () => (searchable && open ? filterOptions(options, query) : options),
    [options, query, searchable, open],
  );

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIdx(options.findIndex(o => o === value));
    if (searchable) requestAnimationFrame(() => inputRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => nextIndex(i, 1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => nextIndex(i, -1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < filtered.length) commit(filtered[activeIdx]);
    }
  }

  const activeId = activeIdx >= 0 && activeIdx < filtered.length ? `${listId}-opt-${activeIdx}` : undefined;

  // flashKey > 0 and changed → remount the field so the red pulse replays.
  const flashing = (flashKey ?? 0) > 0;

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        key={flashing ? flashKey : 'field'}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        className={`flex h-7 w-full items-center justify-between gap-1 rounded-md border bg-white pl-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${
          value ? 'pr-9' : 'pr-2'
        } ${invalid ? 'border-red-500' : 'border-slate-300'} ${value ? 'text-slate-700' : 'text-slate-400'} ${
          flashing ? 'animate-flash-required' : ''
        }`}
      >
        <span className="truncate">{value || placeholder}</span>
        {!value && <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />}
      </button>
      {value && (
        <span className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          <button
            type="button"
            aria-label={`Clear ${ariaLabel}`}
            onClick={() => onChange('')}
            className="rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
          <ChevronDown className="pointer-events-none h-3 w-3 text-slate-400" aria-hidden="true" />
        </span>
      )}
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[160px] rounded-md border border-slate-200 bg-white shadow-lg">
          {searchable && (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search"
              aria-label={`Search ${ariaLabel}`}
              className="w-full border-b border-slate-200 px-2 py-1 text-[12px] focus:outline-none"
            />
          )}
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 && <li className="px-2 py-1 text-[12px] text-slate-400">No matches</li>}
            {filtered.map((opt, i) => (
              <li
                id={`${listId}-opt-${i}`}
                key={opt}
                role="option"
                aria-selected={opt === value}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(opt)}
                className={`cursor-pointer px-2 py-1 text-[12px] ${
                  i === activeIdx ? 'bg-warm-tint text-slate-900' : 'text-slate-700'
                } ${opt === value ? 'font-medium' : ''}`}
              >
                {opt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
