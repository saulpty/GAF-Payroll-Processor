export const SUPER_ONLY_PREFIXES = [
  '/process', '/action-required', '/payroll-master', '/hrk-summary', '/period-log', '/admin',
] as const;

export type ViewerRow = {
  real_email: string | null;
  email: string | null;
  id: number | string | null;
  display_name: string | null;
  role: string | null;
  all_employees: boolean | null;
  active: boolean | null;
};

export type AccessUser = {
  email: string; display_name: string; role: string; all_employees: boolean; active: boolean;
};

export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function isSuperOnlyPath(path: string): boolean {
  return SUPER_ONLY_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
}

export function canSeePath(isSuper: boolean, path: string): boolean {
  return isSuper || !isSuperOnlyPath(path);
}

export function canSeeSection(isSuper: boolean, sectionId: string): boolean {
  return isSuper || (sectionId !== 'payroll' && sectionId !== 'admin');
}

export function homeFor(isSuper: boolean): string {
  return isSuper ? '/payroll-master' : '/attendance/today';
}

/** 'ready' only for a known, active user. Anything else is 'blocked'. */
export function viewerStatus(row: ViewerRow | null | undefined): 'ready' | 'blocked' {
  if (!row || row.id === null || row.id === undefined || row.id === '') return 'blocked';
  return row.active === true ? 'ready' : 'blocked';
}

export function roleLabel(u: { role: string; all_employees: boolean }): string {
  if (u.role === 'super_user') return 'Super user';
  return u.all_employees ? 'Manager (all employees)' : 'Manager';
}

/** Tab-separated lines for the tech team: email, name, role. Active users only, header first. */
export function techTeamList(users: AccessUser[]): string {
  const lines = users
    .filter(u => u.active)
    .map(u => [normalizeEmail(u.email), u.display_name, roleLabel(u)].join('\t'));
  return ['Email\tName\tRole', ...lines].join('\n');
}
