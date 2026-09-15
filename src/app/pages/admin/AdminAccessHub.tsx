import { useSearchParams } from 'react-router-dom';
import { UserCog, Users } from 'lucide-react';
import UsersTab from '@/app/pages/admin/access/UsersTab';
import GroupsTab from '@/app/pages/admin/access/GroupsTab';

type Tab = 'users' | 'groups';

const TABS: { id: Tab; label: string; icon: typeof UserCog }[] = [
  { id: 'users',  label: 'Users',  icon: UserCog },
  { id: 'groups', label: 'Groups', icon: Users   },
];

export default function AdminAccessHub() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.some(t => t.id === raw) ? raw : 'users';

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
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Access</h1>
          <p className="text-xs text-slate-500 mt-0.5">Who can open the app, and which employees each manager sees</p>
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
        {tab === 'users'  && <UsersTab />}
        {tab === 'groups' && <GroupsTab />}
      </div>
    </div>
  );
}
