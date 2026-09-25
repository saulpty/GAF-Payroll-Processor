# Design system 02: shared parts in `src/app/components/ds/`

Read `src/DESIGN.md` first. **Create exactly these four new files, with exactly the code below.
No other file may be touched**: no page imports them yet, no existing component changes,
nothing under `src/components/ui/` is edited, and `app.tsx` is not changed (a page that uses the
toast wraps itself in `ToastProvider`). Nothing visible changes in the app after this prompt.

The code was written and reviewed outside the app; `comboboxFilter.ts` is covered by
`tests/comboboxFilter.test.ts`. Copy it exactly.

## `src/app/components/ds/comboboxFilter.ts`

```ts
// Pure helpers for ds/Combobox. No React here — keep this file importable
// from plain node:test files too.

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Case- and accent-insensitive substring match. Prefix matches sort first
 * (in their original order), then other substring matches (also in their
 * original order). An empty/blank query returns all options, unchanged.
 */
export function filterOptions(options: string[], query: string): string[] {
  const q = normalize(query.trim());
  if (q === '') return options.slice();

  const prefixMatches: string[] = [];
  const otherMatches: string[] = [];

  for (const opt of options) {
    const n = normalize(opt);
    if (n.startsWith(q)) {
      prefixMatches.push(opt);
    } else if (n.includes(q)) {
      otherMatches.push(opt);
    }
  }

  return [...prefixMatches, ...otherMatches];
}

/**
 * Next list index for ArrowUp/ArrowDown, wrapping around both ends.
 * Returns -1 when the list is empty.
 */
export function nextIndex(current: number, delta: 1 | -1, length: number): number {
  if (length <= 0) return -1;
  let n = (current + delta) % length;
  if (n < 0) n += length;
  return n;
}
```

## `src/app/components/ds/Combobox.tsx`

```tsx
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
```

## `src/app/components/ds/Toast.tsx`

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Tone = 'success' | 'error';
type ToastOptions = { message: string; tone?: Tone; onUndo?: () => void };
type ToastItem = ToastOptions & { id: number; tone: Tone };

const ToastContext = createContext<{ show: (opts: ToastOptions) => void } | null>(null);

// Saving rule (docs/uib/DESIGN.md): bottom-left, non-blocking, "Saved · Undo"
// auto-dismisses at 5s, errors stay until closed.
export function useToast(): { show: (opts: ToastOptions) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      const tone: Tone = opts.tone ?? 'success';
      setToasts(list => [...list, { ...opts, tone, id }]);
      if (tone === 'success') {
        window.setTimeout(() => dismiss(id), 5000);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-2 rounded-md border bg-white px-3 py-2 text-[12px] shadow-lg ${
              t.tone === 'error' ? 'border-red-200 text-red-700' : 'border-slate-200 text-slate-700'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.onUndo && (
              <button
                type="button"
                onClick={() => {
                  t.onUndo?.();
                  dismiss(t.id);
                }}
                className="font-medium text-warm-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
              >
                Undo
              </button>
            )}
            <button
              type="button"
              aria-label="Close"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

## `src/app/components/ds/BulkBar.tsx`

```tsx
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
```

## Report
- Byte size of each of the four files.
- Confirm no other file changed.
