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
