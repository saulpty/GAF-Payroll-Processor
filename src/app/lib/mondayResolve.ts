// Resolves a Monday.com board row to an employees.id.
// Order is the same as the classification engine's rowMatchesEmp:
//   email -> name_aliases -> normalized display_name. No match -> null.
//
// This module deliberately has NO imports: callers pass `normalizeName` from
// classificationEngine. That keeps one normalizer in the codebase while
// letting Node's TypeScript loader load this file directly for tests.

export interface ResolvableEmployee { id: number; display_name: string; teramind_email: string | null }
export interface ResolvableAlias { alias_text: string; employee_id: number }
export type NormalizeFn = (s: string) => string;
export type Resolver = (name: string | null | undefined, email: string | null | undefined) => number | null;

export function buildResolver(
  employees: ResolvableEmployee[],
  aliases: ResolvableAlias[],
  normalize: NormalizeFn,
): Resolver {
  const byEmail = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const e of employees) {
    if (e.teramind_email) byEmail.set(e.teramind_email.trim().toLowerCase(), e.id);
    byName.set(normalize(e.display_name), e.id);
  }
  const byAlias = new Map<string, number>();
  for (const a of aliases) byAlias.set(normalize(a.alias_text), a.employee_id);

  return (name, email) => {
    const em = (email ?? '').trim().toLowerCase();
    if (em && byEmail.has(em)) return byEmail.get(em)!;
    const nm = name ? normalize(name) : '';
    if (nm && byAlias.has(nm)) return byAlias.get(nm)!;
    if (nm && byName.has(nm)) return byName.get(nm)!;
    return null;
  };
}
