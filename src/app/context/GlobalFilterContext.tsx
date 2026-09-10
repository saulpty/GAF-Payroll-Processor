'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

export interface GlobalFilters {
  periodsVersion: number;
  bumpPeriodsVersion: () => void;
  ptoVersion: number;
  bumpPtoVersion: () => void;
  period: string;
  setPeriod: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  attendancePeriods: string[];
  setAttendancePeriods: (names: string[], range: { from: string; to: string } | null) => void;
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

const GlobalFilterContext = createContext<GlobalFilters | null>(null);

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [periodsVersion, setPeriodsVersion] = useState(0);
  const bumpPeriodsVersion = () => setPeriodsVersion(v => v + 1);
  const [ptoVersion, setPtoVersion] = useState(0);
  const bumpPtoVersion = () => setPtoVersion(v => v + 1);
  const [period,    setPeriod]    = useState('');
  const [dateFrom,  setDateFromRaw] = useState('');
  const [dateTo,    setDateToRaw]   = useState('');
  const [attendancePeriods, setAttendancePeriodsRaw] = useState<string[]>([]);
  const [employee,  setEmployee]  = useState('');
  const [role,      setRole]      = useState('');
  const [manager,   setManager]   = useState('');
  const [statusTab, setStatusTab] = useState<'RED' | 'YELLOW'>('RED');
  const [pmTab,     setPmTab]     = useState<'ALL' | 'GREEN' | 'YELLOW' | 'RED'>('ALL');

  const setDateFrom = (v: string) => setDateFromRaw(v);
  const setDateTo   = (v: string) => setDateToRaw(v);

  const setAttendancePeriods = (names: string[], range: { from: string; to: string } | null) => {
    setAttendancePeriodsRaw(names);
    if (range) {
      setDateFromRaw(range.from);
      setDateToRaw(range.to);
    }
  };

  const hasAny = !!(period || employee || role || manager || attendancePeriods.length > 0);

  const clearAll = () => {
    setPeriod('');
    setDateFromRaw('');
    setDateToRaw('');
    setAttendancePeriodsRaw([]);
    setEmployee('');
    setRole('');
    setManager('');
  };

  const value = useMemo(() => ({
    periodsVersion, bumpPeriodsVersion,
    ptoVersion, bumpPtoVersion,
    period, setPeriod,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    attendancePeriods, setAttendancePeriods,
    employee, setEmployee,
    role, setRole,
    manager, setManager,
    statusTab, setStatusTab,
    pmTab, setPmTab,
    hasAny,
    clearAll,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [periodsVersion, ptoVersion, period, dateFrom, dateTo, attendancePeriods, employee, role, manager, statusTab, pmTab, hasAny]);

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
