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
