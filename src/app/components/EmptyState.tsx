import type { ReactNode } from 'react';

export default function EmptyState({ icon, title, hint, action, compact }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-slate-200 bg-white ${compact ? 'py-6' : 'py-10'}`}>
      {icon && <div className="text-slate-300 mb-2">{icon}</div>}
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
