# AR-14: Messages that are announced, pause on hover, and say what happened

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these four files may change:**
1. `src/app/components/ds/Toast.tsx` (replace the whole file)
2. `src/app/components/ds/Combobox.tsx` (one exact edit)
3. `src/app/pages/action-required/useArCommit.ts` (one exact edit)
4. `src/app/pages/ActionRequired.tsx` (two exact edits)

No other file may be touched.

## Why (design review, 2026-09-25)
- Toasts were added together with their live region, so screen readers often skipped them. The
  **Undo of a payroll commit** vanished after 5 s even while you were reaching for it. Now both live
  regions are always there, the timer pauses while the mouse or keyboard is on a toast, and a toast
  with Undo stays 10 s.
- "All Events" / empty dropdowns were too faint to read (slate-400 → slate-500).
- Revert from the Committed list now confirms: "Moved Ana López back to Action Required".
- Changing the period silently threw away unsaved edits; it now says how many were discarded.
- While the table reloads it was dimmed for the mouse but still editable by keyboard; `inert` locks it.

### `src/app/components/ds/Toast.tsx`

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

type Tone = 'success' | 'error';
type ToastOptions = { message: string; tone?: Tone; onUndo?: () => void };
type ToastItem = ToastOptions & { id: number; tone: Tone };

const ToastContext = createContext<{ show: (opts: ToastOptions) => void } | null>(null);

// Saving rule (docs/uib/DESIGN.md): bottom-left, non-blocking, "Saved · Undo".
// Success auto-dismisses after 5 s, or 10 s when it offers Undo; the timer pauses
// while the pointer or keyboard focus is on the toast. Errors stay until closed.
// Both live regions are always mounted so screen readers announce new toasts (AR-14).
export function useToast(): { show: (opts: ToastOptions) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

function ToastCard({ t, onDismiss }: { t: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(t.onUndo ? 10000 : 5000);

  useEffect(() => {
    if (t.tone !== 'success' || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(t.id), left.current);
    return () => { window.clearTimeout(timer); left.current -= Date.now() - started; };
  }, [paused, t.id, t.tone, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
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
            onDismiss(t.id);
          }}
          className="font-medium text-warm-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
        >
          Undo
        </button>
      )}
      <button
        type="button"
        aria-label="Close"
        onClick={() => onDismiss(t.id)}
        className="rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts(list => list.filter(t => t.id !== id));
  }, []);

  const show = useCallback((opts: ToastOptions) => {
    const id = nextId.current++;
    setToasts(list => [...list, { ...opts, tone: opts.tone ?? 'success', id }]);
  }, []);

  const region = (tone: Tone) => toasts.filter(t => t.tone === tone).map(t => <ToastCard key={t.id} t={t} onDismiss={dismiss} />);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-80 flex-col gap-2">
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">{region('error')}</div>
        <div role="status" aria-live="polite" className="flex flex-col gap-2">{region('success')}</div>
      </div>
    </ToastContext.Provider>
  );
}
```

### `src/app/components/ds/Combobox.tsx`: one edit

Replace exactly:
```
${value ? 'text-slate-700' : 'text-slate-400'}
```
with exactly:
```
${value ? 'text-slate-700' : 'text-slate-500'}
```

### `src/app/pages/action-required/useArCommit.ts`: one edit

In `handleRevert`, replace exactly:
```ts
      await refresh();
    } catch {
      toast.show({ tone: 'error', message: `Could not revert
```
with exactly:
```ts
      await refresh();
      toast.show({ message: `Moved ${r.employee_name} back to Action Required` });
    } catch {
      toast.show({ tone: 'error', message: `Could not revert
```

### `src/app/pages/ActionRequired.tsx`: two edits

Edit 1, in the "Sync params when global period changes" effect, replace exactly:
```tsx
    setParams({ periodName: selectedPeriod });
    discardAll();
```
with exactly:
```tsx
    setParams({ periodName: selectedPeriod });
    if (dirtyCount > 0) toast.show({ message: `Discarded ${dirtyCount} unsaved ${dirtyCount === 1 ? 'row' : 'rows'} when the period changed.` });
    discardAll();
```

Edit 2, on the work-table container, replace exactly:
```tsx
            aria-busy={loading || undefined}>
```
with exactly:
```tsx
            aria-busy={loading || undefined} inert={loading || undefined}>
```

Nothing else in these files changes.

## Report
For each file: size in bytes before and after (all must stay under 15,000). Confirm no other file changed.
