import { useSearchParams } from 'react-router-dom';
import { Users, RefreshCw, Tag } from 'lucide-react';

import RosterTab from '@/app/pages/admin/employees/RosterTab';
import MondayTab from '@/app/pages/admin/employees/MondayTab';
import AliasesTab from '@/app/pages/admin/employees/AliasesTab';

type Tab = 'roster' | 'monday' | 'aliases';

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'roster',  label: 'Roster',  icon: Users     },
  { id: 'monday',  label: 'Monday',  icon: RefreshCw },
  { id: 'aliases', label: 'Aliases', icon: Tag       },
];

export default function AdminEmployeesHub() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.some(t => t.id === raw) ? raw : 'roster';

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 pt-5 pb-0 shrink-0">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Employees</h1>
          <p className="text-xs text-slate-500 mt-0.5">Roster · Monday · Aliases</p>
        </div>

        {/* Tab strip */}
        <div className="flex gap-0.5 border-b border-slate-200">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${active
                    ? 'border-slate-800 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
              >
                <t.icon className="w-3.5 h-3.5 opacity-75" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {tab === 'roster'  && <RosterTab />}
        {tab === 'monday'  && <MondayTab />}
        {tab === 'aliases' && <AliasesTab />}
      </div>
    </div>
  );
}


