'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); }

export interface GlobalFilters {
  period: string;
  setPeriod: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  employee: string;
  setEmployee: (v: string) => void;
  role: string;
  setRole: (v: string) => void;
  manager: string;
  setManager: (v: string) => void;
  statusTab: 'RED' | 'YELLOW';
  setStatusTab: (v: 'RED' | 'YELLOW') => void;
  pmTab: 'ALL' | 'GREEN' | 'YELLOW' | 'RED';
  setPmTab: (v: 'ALL' | 'GREEN' | 'YELLOW' | 'RED') => void;
  hasAny: boolean;
  clearAll: () => void;
}

const TODAY = fmt(new Date());
const DEFAULT_FROM = daysAgo(30);

const GlobalFilterContext = createContext<GlobalFilters | null>(null);

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [period,   setPeriod]   = useState('');
  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo,   setDateTo]   = useState(TODAY);
  const [employee, setEmployee] = useState('');
  const [role,     setRole]     = useState('');
  const [manager,  setManager]  = useState('');
  const [statusTab, setStatusTab] = useState<'RED' | 'YELLOW'>('RED');
  const [pmTab, setPmTab] = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');

  const hasAny = !!(period || employee || role || manager ||
    dateFrom !== DEFAULT_FROM || dateTo !== TODAY);

  const clearAll = () => {
    setPeriod('');
    setDateFrom(DEFAULT_FROM);
    setDateTo(TODAY);
    setEmployee('');
    setRole('');
    setManager('');
  };

  const value = useMemo(() => ({
    period, setPeriod,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    employee, setEmployee,
    role, setRole,
    manager, setManager,
    statusTab, setStatusTab,
    pmTab, setPmTab,
    hasAny,
    clearAll,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [period, dateFrom, dateTo, employee, role, manager, statusTab, pmTab, hasAny]);

  return (
    <GlobalFilterContext.Provider value={value}>
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilters(): GlobalFilters {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) throw new Error('useGlobalFilters must be used inside GlobalFilterProvider');
  return ctx;
}
