import type { ReactNode } from 'react';

// The visible page name lives in the navigation's second row (SectionBar) since 2026-10-06, so
// the title here is for screen readers only; the description and the actions stay visible.
export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
      <div className="min-w-0">
        <h1 className="sr-only">{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
