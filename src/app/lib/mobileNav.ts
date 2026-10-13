// Rules for the phone's section bar. Pure: no imports, so tests/mobileShell.test.ts runs it directly.

/** Section ids for the phone, in the computer's order. `bar` = the bottom bar; `more` = under More. */
export function mobileNavItems(isSuper: boolean): { bar: string[]; more: string[] } {
  return {
    bar: ['attendance', 'disciplinary', 'contracts', 'pto'],
    more: isSuper ? ['payroll', 'admin'] : [],
  };
}

/** The orange count on a section, or null for none. One rule for the top bar and the bottom bar. */
export function navBadge(
  id: string,
  badges: { contracts: number; disciplinary: number; pto: number },
  isSuper: boolean,
): { count: number; label: string } | null {
  // A manager never sees the Disciplinary count.
  if (!isSuper && id === 'disciplinary') return null;
  if (id === 'contracts' && badges.contracts > 0) {
    return {
      count: badges.contracts,
      label: `${badges.contracts} contract${badges.contracts === 1 ? '' : 's'} ending within 30 days`,
    };
  }
  if (id === 'disciplinary' && badges.disciplinary > 0) {
    return {
      count: badges.disciplinary,
      label: `${badges.disciplinary} disciplinary re-evaluation${badges.disciplinary === 1 ? '' : 's'} due`,
    };
  }
  if (id === 'pto' && badges.pto > 0) {
    return {
      count: badges.pto,
      label: `${badges.pto} PTO request${badges.pto === 1 ? '' : 's'} ready to record`,
    };
  }
  return null;
}
