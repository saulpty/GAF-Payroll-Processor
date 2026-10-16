# The International Directory board keeps those employees up to date

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

A second Monday board, the International Employee Directory, lists employees outside Panama. Its
settings are config keys `monday_board_directory_intl`, `monday_group_intl_current`,
`monday_col_intl_email`, `monday_col_intl_role`, `monday_col_intl_country`, `monday_col_intl_manager`.
This prompt adds a sync for it that runs right after the Panama Directory sync, on the same
automatic schedule. **The Panama Directory sync does not change.**

**Only these files may change:** one new file
`src/app/pages/admin/employees/syncIntlDirectory.ts`; edited
`src/app/components/MondayAutoSync.tsx`, `src/actions/updateEmployeeRoleManager.ts`,
`src/actions/upsertEmployee.ts`, `src/actions/loadAllEmployees.ts`. **No other file may be
touched.** Do **not** edit `syncDirectory.ts` or `MondayTab.tsx`.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- `{{params.x}}` is substituted whole: never inside a quoted string.
- Never hardcode a Monday board, group or column id. Every file stays under 15 KB.

## 1. `src/actions/loadAllEmployees.ts`

After the line `COALESCE(e.manager, '') AS manager,` add:

```sql
             e.country,
```

## 2. `src/actions/updateEmployeeRoleManager.ts`

The SET clause becomes:

```sql
         SET role    = {{params.role}},
             manager = {{params.manager}},
             country = COALESCE(NULLIF({{params.country}}, ''), country)
```

(Existing callers send no country, so they keep the stored one.)

## 3. `src/actions/upsertEmployee.ts`

- Add `country` to the INSERT column list, after `manager`.
- In the SELECT list, after `{{params.manager}}`, add: `, COALESCE(NULLIF({{params.country}}, ''), 'Panama')`
- In `DO UPDATE SET`, put a comma after the `manager = …` line and add:
  `country = COALESCE(NULLIF({{params.country}}, ''), employees.country)`

## 4. New file `src/app/pages/admin/employees/syncIntlDirectory.ts`

The whole file:

```ts
// International Employee Directory sync. Runs after the Panama Directory sync.
// Pure async function, no React. Matches by email ONLY (never by name, so it can never pick up a
// Panama employee), and never touches an employee whose country is the payroll country.
import { pullAllItems, colText, requireKeys, type PullFn } from './mondaySync';

const REQUIRED = ['monday_board_directory_intl', 'monday_group_intl_current', 'monday_col_intl_email'] as const;
const OPTIONAL = ['monday_col_intl_role', 'monday_col_intl_country', 'monday_col_intl_manager'] as const;

type Emp = {
  id: number; display_name: string; teramind_email: string; active: boolean;
  is_grace_list: boolean; excluded_from_payroll: boolean;
  role: string; manager: string; country?: string | null;
};

export type IntlDeps = {
  cfg: Record<string, string>;
  pull: PullFn;
  emps: Emp[];
  updateRoleManager: (p: { id: number; role: string | null; manager: string | null; country: string }) => Promise<unknown>;
  updateFlag: (p: { id: number; is_grace_list: boolean; excluded_from_payroll: boolean; active: boolean }) => Promise<unknown>;
  upsertEmp: (p: Record<string, unknown>) => Promise<unknown>;
  defaultScheduleId: number;
};

export type IntlResult = { items: number; updated: number; created: number; skipped: number; summary: string };

export async function syncIntlDirectory(deps: IntlDeps): Promise<IntlResult> {
  const off: IntlResult = { items: 0, updated: 0, created: 0, skipped: 0, summary: 'international directory not configured' };
  if (!deps.cfg.monday_board_directory_intl) return off;
  const check = requireKeys(deps.cfg, REQUIRED);
  if (!check.ok) throw new Error('Missing config: ' + check.missing.join(', '));
  const k = { ...check.map } as Record<string, string>;
  for (const key of OPTIONAL) k[key] = (deps.cfg[key] ?? '').trim();

  const payrollCountry = (deps.cfg.payroll_country || 'Panama').trim();
  const cols = [k.monday_col_intl_email, ...OPTIONAL.map(key => k[key]).filter(Boolean)];
  const items = await pullAllItems(k.monday_board_directory_intl, cols, deps.pull);
  const txt = (it: Parameters<typeof colText>[0], key: string) => (k[key] ? colText(it, k[key]).trim() : '');

  const byEmail = new Map(deps.emps.map(e => [e.teramind_email.toLowerCase(), e]));
  let updated = 0, created = 0, skipped = 0;
  const toCreate: { name: string; email: string; role: string; manager: string; country: string }[] = [];

  for (const it of items) {
    const email = colText(it, k.monday_col_intl_email).trim().toLowerCase();
    if (!email) continue;
    const isCurrent = it.group?.id === k.monday_group_intl_current;
    const role = txt(it, 'monday_col_intl_role');
    const manager = txt(it, 'monday_col_intl_manager');
    const country = txt(it, 'monday_col_intl_country') || 'International';
    const emp = byEmail.get(email);

    if (!emp) {
      if (isCurrent) toCreate.push({ name: it.name, email, role, manager, country });
      continue;
    }
    if ((emp.country || 'Panama') === payrollCountry) { skipped++; continue; }

    let changed = false;
    if (role !== (emp.role || '') || manager !== (emp.manager || '') || country !== emp.country) {
      await deps.updateRoleManager({ id: emp.id, role: role || null, manager: manager || null, country });
      changed = true;
    }
    if (isCurrent !== emp.active) {
      await deps.updateFlag({ id: emp.id, is_grace_list: emp.is_grace_list,
        excluded_from_payroll: emp.excluded_from_payroll, active: isCurrent });
      changed = true;
    }
    if (changed) updated++;
  }

  // Same brake as the Panama sync: more than 3 new people at once is held for review.
  if (toCreate.length > 3) {
    const summary = `international directory: ${toCreate.length} new people need review, none created`;
    return { items: items.length, updated, created: 0, skipped, summary };
  }
  for (const c of toCreate) {
    await deps.upsertEmp({
      display_name: c.name, teramind_email: c.email, company_domain: c.email.split('@')[1] ?? '',
      schedule_id: deps.defaultScheduleId, is_grace_list: false, excluded_from_payroll: false, active: true,
      notes: 'Added via International Directory sync', role: c.role || null, manager: c.manager || null,
      country: c.country,
    });
    created++;
  }
  const summary = `international directory: ${updated} updated · ${created} created`
    + (skipped ? ` · ${skipped} skipped (on the ${payrollCountry} roster)` : '');
  return { items: items.length, updated, created, skipped, summary };
}
```

If `PullFn` or `MondayItem` are exported under different names in `mondaySync.ts`, use the real
names and say so. Do not change `mondaySync.ts`.

## 5. `src/app/components/MondayAutoSync.tsx`

a. Add the import next to the `syncDirectory` import:

```ts
import { syncIntlDirectory } from '@/app/pages/admin/employees/syncIntlDirectory';
```

b. In the `board.kind === 'directory'` branch, directly **before** the comment
`// Also sync access groups, best-effort`, add:

```ts
              // International Directory board (a second board; off while its config is empty)
              try {
                const intl = await syncIntlDirectory({
                  cfg, pull: (p) => pullBoard(p), emps, updateRoleManager, updateFlag, upsertEmp, defaultScheduleId,
                });
                created += intl.created;
                if (intl.created || intl.updated || intl.summary.includes('need review')) console.info(intl.summary);
              } catch (e) {
                console.warn('Monday auto-sync (international directory) failed:', e);
              }
```

Nothing else in the file changes. If TypeScript complains that `emps` lacks `country`, cast it the
same way the file already casts it for `syncDirectory`.

Reply with the full new file and the diff of the four edited files.
