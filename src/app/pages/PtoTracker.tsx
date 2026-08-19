import { useSearchParams } from 'react-router-dom';
import { Palmtree, CalendarCheck, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import BalancesTab from './pto/BalancesTab';
import ApprovalsTab from './pto/ApprovalsTab';

type Tab = 'balances' | 'approvals' | 'floating-holidays';

const TABS: { id: Tab; label: string; icon: typeof Palmtree }[] = [
  { id: 'balances',          label: 'Balances',          icon: Palmtree     },
  { id: 'approvals',         label: 'Approvals',          icon: CalendarCheck },
  { id: 'floating-holidays', label: 'Floating Holidays', icon: Star          },
];

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="p-6">
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {label} — Coming next
        </CardContent>
      </Card>
    </div>
  );
}

export default function PtoTracker() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.some(t => t.id === raw) ? raw : 'balances';

  const setTab = (id: Tab) => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 pb-0 shrink-0">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-800 leading-tight">PTO Tracker</h1>
          <p className="text-xs text-slate-500 mt-0.5">Balances · Approvals · Floating Holidays</p>
        </div>
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

      <div className="flex-1 overflow-auto">
        {tab === 'balances'          && <BalancesTab />}
        {tab === 'approvals'         && <ApprovalsTab />}
        {tab === 'floating-holidays' && <ComingSoon label="Floating Holidays" />}
      </div>
    </div>
  );
}
