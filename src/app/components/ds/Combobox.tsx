import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { filterOptions, nextIndex } from '@/app/components/ds/comboboxFilter';

// Dropdowns rule (docs/uib/DESIGN.md): searchable when > 7 options, empty
// shows "—", a × clears back to empty, no "None" / "— pick —" option.
// The open list is portalled to <body> with fixed positioning (AR-9): inside a
// scrolling table it was clipped and hidden behind other cells. It opens upward
// when there is no room below, and closes when the page or table scrolls.
export function Combobox({
  value,
  options,
  onChange,
  placeholder = '—',
  ariaLabel,
  invalid = false,
  flashKey,
  className = '',
  toneOf,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
  flashKey?: number;
  className?: string;
  /** Optional colour dot per option (a Tailwind bg class), e.g. green for paid impacts. */
  toneOf?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchable = options.length > 7;

  const filtered = useMemo(
    () => (searchable && open ? filterOptions(options, query) : options),
    [options, query, searchable, open],
  );

  // Place the list under the field (or above it when the space below is short).
  useLayoutEffect(() => {
    if (!open || !fieldRef.current) return;
    const r = fieldRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 240 && above > below;
    const room = Math.max(120, Math.min(280, up ? above : below));
    setPos({
      position: 'fixed', left: r.left, width: Math.max(r.width, 180), zIndex: 60, maxHeight: room,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      !!t && ((rootRef.current?.contains(t as Node) ?? false) || (popRef.current?.contains(t as Node) ?? false));
    const onDocPointer = (e: MouseEvent) => { if (!inside(e.target)) setOpen(false); };
    const onScroll = (e: Event) => { if (!inside(e.target)) setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    setQuery('');
    setActiveIdx(options.findIndex(o => o === value));
    if (searchable) requestAnimationFrame(() => inputRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(v: string) {
    onChange(v);
    setOpen(false);
    fieldRef.current?.focus();
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
      fieldRef.current?.focus();
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
  const dot = (v: string) => (toneOf && v ? <span className={`h-2 w-2 shrink-0 rounded-full ${toneOf(v)}`} aria-hidden="true" /> : null);

  // flashKey > 0 and changed → remount the field so the red pulse replays.
  const flashing = (flashKey ?? 0) > 0;

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        ref={fieldRef}
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
        } ${invalid ? 'border-red-500' : 'border-slate-300'} ${value ? 'text-slate-700' : 'text-slate-500'} ${
          flashing ? 'animate-flash-required' : ''
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">{dot(value)}<span className="truncate">{value || placeholder}</span></span>
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
      {open && pos && createPortal(
        <div ref={popRef} style={pos} className="flex flex-col rounded-md border border-slate-200 bg-white shadow-lg">
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
              className="w-full shrink-0 border-b border-slate-200 px-2 py-1 text-[12px] focus:outline-none"
            />
          )}
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-auto py-1">
            {filtered.length === 0 && <li className="px-2 py-1 text-[12px] text-slate-400">No matches</li>}
            {filtered.map((opt, i) => (
              <li
                id={`${listId}-opt-${i}`}
                key={opt}
                role="option"
                aria-selected={opt === value}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => commit(opt)}
                className={`flex cursor-pointer items-center gap-1.5 px-2 py-1 text-[12px] ${
                  i === activeIdx ? 'bg-warm-tint text-slate-900' : 'text-slate-700'
                } ${opt === value ? 'font-medium' : ''}`}
              >
                {dot(opt)}{opt}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
