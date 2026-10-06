// Which filters each route shows (moved out of FilterBar.tsx on 2026-10-06 to keep it under
// 15 KB), and when "Clear Filters" should appear.

export type RouteConfig = {
  period?: boolean; dateRange?: boolean; employee?: boolean;
  role?: boolean; manager?: boolean; statusTab?: boolean; pmTab?: boolean;
  periods?: boolean;
};

export const ROUTE_CONFIG: Record<string, RouteConfig> = {
  '/action-required':       { period: true, employee: true, statusTab: true },
  '/payroll-master':        { period: true, employee: true, pmTab: true },
  '/hrk-summary':           { period: true },
  '/process':               { dateRange: true },
  '/attendance/today':      { employee: true, role: true, manager: true },
  '/attendance/list':       { periods: true, dateRange: true, employee: true, role: true, manager: true },
  '/attendance':            { employee: true, role: true, manager: true },
  '/attendance/reports':    { periods: true, dateRange: true, employee: true, role: true, manager: true },
  '/attendance/activity':   { periods: true, dateRange: true, employee: true, role: true, manager: true },
  '/pto':                   { employee: true, role: true, manager: true },
  '/contracts':             { employee: true, role: true, manager: true },
  '/disciplinary':          { employee: true, role: true, manager: true },
};

// Routes with a Periods/Dates switch, keyed to their default mode
export const ATTENDANCE_SWITCH_ROUTES: Record<string, 'periods' | 'dates'> = {
  '/attendance/list':      'periods',
  '/attendance/reports':   'periods',
  '/attendance/activity':  'dates',
};

export function getConfig(pathname: string): RouteConfig | null {
  if (ROUTE_CONFIG[pathname]) return ROUTE_CONFIG[pathname];
  for (const key of Object.keys(ROUTE_CONFIG)) {
    if (key !== '/' && pathname.startsWith(key + '/')) return ROUTE_CONFIG[key];
  }
  return null;
}

export interface FilterState {
  period: string;
  employee: string;
  role: string;
  manager: string;
  isSuper: boolean;
  attendanceMode: 'periods' | 'dates';
  attendancePeriods: string[];
  /** The newest processed period, which Attendance selects by itself. */
  defaultPeriod: string | null;
}

/**
 * "Clear Filters" shows only when a filter THIS page displays holds a value the user chose
 * (Saul, 2026-10-06: it appeared with no filter set). Not counted: values remembered from
 * another page that this page does not show, the Manager filter for non-superusers (hidden),
 * and the newest period Attendance picks on its own.
 */
export function hasVisibleFilter(cfg: RouteConfig | null, s: FilterState): boolean {
  if (!cfg) return false;
  if (cfg.period && s.period) return true;
  if (cfg.employee && s.employee) return true;
  if (cfg.role && s.role) return true;
  if (cfg.manager && s.isSuper && s.manager) return true;
  const periodsShown = !!cfg.periods && (!cfg.dateRange || s.attendanceMode === 'periods');
  if (periodsShown && s.attendancePeriods.length > 0) {
    const onlyDefault = s.attendancePeriods.length === 1 && s.attendancePeriods[0] === s.defaultPeriod;
    if (!onlyDefault) return true;
  }
  return false;
}
