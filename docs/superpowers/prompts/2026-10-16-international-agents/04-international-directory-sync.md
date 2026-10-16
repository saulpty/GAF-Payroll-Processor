# The International Directory board keeps those employees up to date

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

A second Monday board, the International Employee Directory, lists employees outside Panama. Its
settings are already in `classification_config` (`monday_board_directory_intl`,
`monday_group_intl_current`, `monday_col_intl_email`, `monday_col_intl_role`,
`monday_col_intl_country`, `monday_col_intl_manager`). This prompt adds a sync for it that runs
right after the Panama Directory sync, on the same automatic schedule. **The Panama Directory sync
does not change.**

The decision logic goes in a pure file with no runtime imports (like `accessSeed.ts`), so it can
be tested; the Monday and database calls go in a thin second file.

**Only these files may change:** two new files `src/app/lib/intlDirectoryPlan.ts` and
`src/app/pages/admin/employees/syncIntlDirectory.ts`; edited
`src/app/components/MondayAutoSync.tsx`, `src/actions/updateEmployeeRoleManager.ts`,
`src/actions/upsertEmployee.ts`, `src/actions/loadAllEmployees.ts`. **No other file may be
touched.** Do **not** edit `syncDirectory.ts`, `mondaySync.ts` or `MondayTab.tsx`.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- `{{params.x}}` is substituted whole: never inside a quoted string.
- Never hardcode a Monday board, group or column id. Every file stays under 15 KB.
- `intlDirectoryPlan.ts` may only have `import type` lines.

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

## 4. New file `src/app/lib/intlDirectoryPlan.ts`

The whole file:

```ts
// International Employee Directory: what to change, decided without any I/O.
// Matches by email ONLY (never by name, so it can never pick up a Panama employee) and never
// touches an employee whose country is the payroll country. Only `import type` here.
import type { MondayItem } from '@/app/pages/admin/employees/mondaySync';

export type IntlCols = { email: string; currentGroup: string; role: string; country: string; manager: string };

export type IntlEmp = {
  id: number; teramind_email: string; active: boolean;
  is_grace_list: boolean; excluded_from_payroll: boolean;
  role: string; manager: string; country?: string | null;
};

export type IntlNew = { name: string; email: string; role: string; manager: string; country: string };

export type IntlPlan = {
  details: { id: number; role: string | null; manager: string | null; country: string }[];
  flags: { id: number; is_grace_list: boolean; excluded_from_payroll: boolean; active: boolean }[];
  toCreate: IntlNew[];
  held: number;     // new people not created because more than MAX_NEW arrived at once
  skipped: number;  // board rows whose email belongs to a payroll-country employee
};

export const MAX_NEW = 3;
export const DEFAULT_COUNTRY = 'International';

const text = (it: MondayItem, col: string) =>
  col ? (it.column_values.find(c => c.id === col)?.text ?? '').trim() : '';

export function planIntlDirectory(items: MondayItem[], emps: IntlEmp[], cols: IntlCols, payrollCountry: string): IntlPlan {
  const plan: IntlPlan = { details: [], flags: [], toCreate: [], held: 0, skipped: 0 };
  const byEmail = new Map(emps.map(e => [e.teramind_email.trim().toLowerCase(), e]));
  const seen = new Set<string>();
  const fresh: IntlNew[] = [];

  for (const it of items) {
    const email = text(it, cols.email).toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const isCurrent = it.group?.id === cols.currentGroup;
    const role = text(it, cols.role);
    const manager = text(it, cols.manager);
    const country = text(it, cols.country) || DEFAULT_COUNTRY;
    const emp = byEmail.get(email);

    if (!emp) {
      if (isCurrent) fresh.push({ name: it.name.trim(), email, role, manager, country });
      continue;
    }
    if ((emp.country || 'Panama') === payrollCountry) { plan.skipped++; continue; }

    if (role !== (emp.role || '') || manager !== (emp.manager || '') || country !== emp.country) {
      plan.details.push({ id: emp.id, role: role || null, manager: manager || null, country });
    }
    if (isCurrent !== emp.active) {
      plan.flags.push({ id: emp.id, is_grace_list: emp.is_grace_list,
        excluded_from_payroll: emp.excluded_from_payroll, active: isCurrent });
    }
  }

  if (fresh.length > MAX_NEW) plan.held = fresh.length;
  else plan.toCreate = fresh;
  return plan;
}
```

## 5. New file `src/app/pages/admin/employees/syncIntlDirectory.ts`

The whole file:

```ts
// International Employee Directory sync: runs after the Panama Directory sync.
// Decisions live in planIntlDirectory (pure, tested); this file only reads Monday and writes.
import { pullAllItems, requireKeys, type PullFn } from './mondaySync';
import { planIntlDirectory, type IntlEmp } from '@/app/lib/intlDirectoryPlan';

const REQUIRED = ['monday_board_directory_intl', 'monday_group_intl_current', 'monday_col_intl_email'] as const;

export type IntlDeps = {
  cfg: Record<string, string>;
  pull: PullFn;
  emps: IntlEmp[];
  updateRoleManager: (p: { id: number; role: string | null; manager: string | null; country: string }) => Promise<unknown>;
  updateFlag: (p: { id: number; is_grace_list: boolean; excluded_from_payroll: boolean; active: boolean }) => Promise<unknown>;
  upsertEmp: (p: Record<string, unknown>) => Promise<unknown>;
  defaultScheduleId: number;
};

export type IntlResult = { items: number; updated: number; created: number; held: number; skipped: number; summary: string };

export async function syncIntlDirectory(deps: IntlDeps): Promise<IntlResult> {
  if (!(deps.cfg.monday_board_directory_intl ?? '').trim()) {
    return { items: 0, updated: 0, created: 0, held: 0, skipped: 0, summary: 'international directory not configured' };
  }
  const check = requireKeys(deps.cfg, REQUIRED);
  if (!check.ok) throw new Error('Missing config: ' + check.missing.join(', '));
  const opt = (key: string) => (deps.cfg[key] ?? '').trim();
  const cols = {
    email: check.map.monday_col_intl_email, currentGroup: check.map.monday_group_intl_current,
    role: opt('monday_col_intl_role'), country: opt('monday_col_intl_country'), manager: opt('monday_col_intl_manager'),
  };
  const items = await pullAllItems(check.map.monday_board_directory_intl,
    [cols.email, cols.role, cols.country, cols.manager].filter(Boolean), deps.pull);
  const plan = planIntlDirectory(items, deps.emps, cols, opt('payroll_country') || 'Panama');

  for (const d of plan.details) await deps.updateRoleManager(d);
  for (const f of plan.flags) await deps.updateFlag(f);
  for (const c of plan.toCreate) {
    await deps.upsertEmp({
      display_name: c.name, teramind_email: c.email, company_domain: c.email.split('@')[1] ?? '',
      schedule_id: deps.defaultScheduleId, is_grace_list: false, excluded_from_payroll: false, active: true,
      notes: 'Added via International Directory sync', role: c.role || null, manager: c.manager || null,
      country: c.country,
    });
  }
  const updated = new Set([...plan.details, ...plan.flags].map(x => x.id)).size;
  const summary = `international directory: ${updated} updated · ${plan.toCreate.length} created`
    + (plan.held ? ` · ${plan.held} new people need review, none created` : '')
    + (plan.skipped ? ` · ${plan.skipped} skipped (on the payroll roster)` : '');
  return { items: items.length, updated, created: plan.toCreate.length, held: plan.held, skipped: plan.skipped, summary };
}
```

## 6. `src/app/components/MondayAutoSync.tsx`

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
                  cfg, pull: (p) => pullBoard(p),
                  emps: emps as unknown as Parameters<typeof syncIntlDirectory>[0]['emps'],
                  updateRoleManager, updateFlag, upsertEmp, defaultScheduleId,
                });
                created += intl.created;
                if (intl.created || intl.updated || intl.held) console.info(intl.summary);
              } catch (e) {
                console.warn('Monday auto-sync (international directory) failed:', e);
              }
```

Nothing else in the file changes.

Reply with both new files in full and the diff of the four edited files.
