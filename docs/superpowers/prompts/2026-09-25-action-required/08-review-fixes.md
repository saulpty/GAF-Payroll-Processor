# AR-8: code-review fixes before release (Discount column accuracy, Undo order, warning aliases)

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these six files may change:**
1. `src/app/pages/action-required/ArRow.tsx` (whole file)
2. `src/app/pages/action-required/useArSave.ts` (whole file)
3. `src/app/lib/teramindCoverage.ts` (whole file)
4. `src/actions/loadCommittedEntries.ts` (whole file)
5. `src/app/pages/ProcessPayroll.tsx`: exactly the two replacements in section 5 (warning only).
6. `src/app/pages/ActionRequired.tsx`: exactly the two replacements in section 6.

No other file may be touched. Pay rules are unchanged: the Discount column is display-only and now
uses the same inputs the save uses.

## What each fixes (independent code review)
- **Discount column could disagree with the commit**: it used stored minutes on unedited rows,
  while the save always recomputes from the punches. Now it always recomputes too.
- **"Paid" showed before an impact was chosen**: now only when every chosen event has its impact.
- **Undo wrote times before the entry**: a half-failed Undo could leave a row green with old
  minutes. The entry is now written first.
- **Committed "Updated" was UTC**: now Panama wall-clock (`AT TIME ZONE 'America/Panama'`, as the
  Disciplinary loader already does). `updated_at` is `timestamptz`; ordering is unchanged.
- **Teramind warning ignored aliases** (and matched by name when the email was someone else's):
  now the same order as the engine: own email, never another roster email, then name or alias.
- **Bulk hint over-counted** selected rows hidden by a filter: now the visible selected count.

## `src/app/pages/action-required/ArRow.tsx` (whole file)

```tsx
import { Check, Send } from 'lucide-react';
import { TimeInput } from '@/app/components/TimeInput';
import { Combobox } from '@/app/components/ds/Combobox';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import { computeDiscount, toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtShift } from '@/app/lib/fmtTime';
import { discountLabel, fmtMinutes, missingEvent } from './arLogic';
import type { EditState, EntryRow } from './arTypes';

const THIS_YEAR = toLocalYMD(new Date()).slice(0, 4);
const td = 'px-2 py-1.5 border-b border-slate-100';
const timeBox = 'w-full h-7 rounded-md border border-slate-300 bg-white px-1.5 text-[12px] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring';

/** One editable row of the work table (AR-4: Warm look, per src/DESIGN.md). */
export function ArRow({
  row, rowIndex, edit, dirty, isSelected, selectedSize, showPeriod,
  eventOpts, impactOptions, docOpts, visibleRows, onToggle, onEdit, canCommitOne, onCommitOne,
}: {
  row: EntryRow; rowIndex: number; edit: EditState; dirty: boolean;
  isSelected: boolean; selectedSize: number; showPeriod: boolean;
  eventOpts: string[]; impactOptions: string[]; docOpts: string[];
  visibleRows: EntryRow[];
  onToggle: (id: number, index: number, shiftKey: boolean) => void;
  onEdit: (id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => void;
  /** Show this row's own Commit button (one-offs; the bulk bar is for 2+ rows). */
  canCommitOne: boolean;
  onCommitOne: (row: EntryRow) => void;
}) {
  const needsEvent = missingEvent(edit);
  // Always recompute from the punches, exactly as the save does (stored minutes can be stale).
  const live = computePunchMinutes({
    entry_time: edit.entry_time, exit_time: edit.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  });
  const late = live ? live.late_minutes : row.late_minutes;
  const early = live ? live.early_leave_minutes : row.early_leave_minutes;
  // What a commit would deduct right now: the same computeDiscount the save uses.
  const discount = discountLabel(computeDiscount({
    event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
    event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
    late_minutes: late, late_after_grace: live ? live.late_after_grace : row.late_after_grace,
    early_leave_minutes: early,
  // "Paid" only once every chosen event also has its impact (the pay decision is made).
  }), !!(edit.event_type_1 || edit.event_type_2) && (!edit.event_type_1 || !!edit.pay_impact_1) && (!edit.event_type_2 || !!edit.pay_impact_2));
  const broadcasting = isSelected && selectedSize > 1;
  const tint = isSelected ? 'bg-warm-tint' : row.initial_status === 'RED' ? 'bg-status-red-tint' : 'bg-status-yellow-tint';
  const bar = isSelected ? 'shadow-[inset_3px_0_0_var(--warm)]' : '';
  const pick = (field: keyof EditState) => (v: string) => onEdit(row.id, field, v, row, visibleRows);
  const combo = (field: keyof EditState, value: string, options: string[], label: string, invalid = false) => (
    <div className={broadcasting ? 'rounded-md ring-1 ring-warm-ring' : ''} title={broadcasting ? `Applies to all ${selectedSize} selected rows` : undefined}>
      <Combobox value={value} options={options} onChange={pick(field)} ariaLabel={`${label}, ${row.employee_name} ${row.work_date.slice(0, 10)}`}
        invalid={invalid} flashKey={invalid ? 1 : 0} className="w-full" />
    </div>
  );

  return (
    <tr className={`${tint} hover:brightness-[0.98] text-[13px] text-slate-800`}>
      <td className={`${td} sticky left-0 z-10 w-10 ${tint} ${bar}`}>
        <input type="checkbox" checked={isSelected} aria-label={`Select ${row.employee_name} ${row.work_date.slice(0, 10)}`}
          onChange={() => {}} onClick={e => onToggle(row.id, rowIndex, e.shiftKey)}
          className="h-4 w-4 rounded border-slate-400 accent-[var(--warm)] cursor-pointer" />
      </td>
      <td className={`${td} sticky left-10 z-10 ${tint}`} style={{ width: 176, minWidth: 176, maxWidth: 176 }}>
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium" title={row.employee_name}>{row.employee_name}</span>
          {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warm" title="Unsaved changes" />}
          {canCommitOne && (
            <button type="button" onClick={() => onCommitOne(row)} title="Commit this row to Green"
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-0.5 text-[11px] font-semibold text-warm-ink hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
              <Send className="w-3 h-3" />Commit
            </button>
          )}
        </div>
      </td>
      {showPeriod && <td className={`${td} whitespace-nowrap text-slate-600`} style={{ width: 110 }}>{row.period_name}</td>}
      <td className={`${td} whitespace-nowrap text-slate-700`} style={{ width: 96 }}>{fmtDay(row.work_date.slice(0, 10), THIS_YEAR)}</td>
      <td className={td} style={{ width: 88, minWidth: 88 }}>
        <TimeInput className={timeBox} value={edit.entry_time} placeholder="9:00 AM" onChange={v => onEdit(row.id, 'entry_time', v, row)} />
      </td>
      <td className={td} style={{ width: 88, minWidth: 88 }}>
        <TimeInput className={timeBox} value={edit.exit_time} placeholder="5:00 PM" onChange={v => onEdit(row.id, 'exit_time', v, row)} />
      </td>
      <td className={`${td} whitespace-nowrap text-[12px] text-slate-500`} style={{ width: 150 }}>{fmtShift(row.work_days, row.scheduled_start, row.scheduled_end)}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${late > 0 ? 'font-semibold text-status-red-ink' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(late) || '—'}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${early > 0 ? 'font-semibold text-status-yellow-ink' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(early) || '—'}</td>
      <td className={`${td} text-right`} style={{ width: 104 }}>
        {discount.tone === 'deduct' && <span className="inline-block whitespace-nowrap rounded-full bg-status-red-tint px-2 py-0.5 text-[12px] font-semibold tabular-nums text-status-red-ink ring-1 ring-status-red-fill">{discount.text}</span>}
        {discount.tone === 'paid' && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-status-green-fill px-2 py-0.5 text-[12px] font-semibold text-status-green-ink"><Check className="w-3 h-3" />Paid</span>}
        {discount.tone === 'none' && <span className="text-slate-300">—</span>}
      </td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_1', edit.event_type_1, eventOpts, 'Event 1', needsEvent === 1)}
        {needsEvent === 1 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_1', edit.pay_impact_1, impactOptions, 'Impact 1')}</td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_2', edit.event_type_2, eventOpts, 'Event 2', needsEvent === 2)}
        {needsEvent === 2 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_2', edit.pay_impact_2, impactOptions, 'Impact 2')}</td>
      <td className={td} style={{ width: 140, minWidth: 140 }}>{combo('documentation', edit.documentation, docOpts, 'Doc')}</td>
      <td className={`${td} text-[12px] text-slate-500`} style={{ maxWidth: 220 }}>
        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
      </td>
      <td className={td} style={{ minWidth: 180 }}>
        <input className="w-full h-7 rounded-md border border-slate-300 bg-white px-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
          value={edit.notes} placeholder="Add a note" onChange={e => onEdit(row.id, 'notes', e.target.value, row)} />
      </td>
    </tr>
  );
}
```

## `src/app/pages/action-required/useArSave.ts` (whole file)

```ts
import { useMutateAction } from '@uibakery/data';
import updatePayrollEntryAction from '@/actions/updatePayrollEntry';
import updatePunchTimesAction from '@/actions/updatePunchTimes';
import { computeDerivedFields } from '@/app/lib/classificationEngine';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import type { CommittedRow, EditState, EntryRow } from './arTypes';

/** Row save and revert, split out of ActionRequired.tsx (AR-1). Same two actions, same order. */
export function useArSave(getEdit: (row: EntryRow) => EditState) {
  const [updateEntry] = useMutateAction(updatePayrollEntryAction);
  const [updateTimes] = useMutateAction(updatePunchTimesAction);

  // Save a single row. Returns the derived status plus the row as saved (what a
  // revert/Undo needs); null when the row was refused.
  const saveRow = async (row: EntryRow): Promise<{ status: string; saved: CommittedRow } | null> => {
    const edit = getEdit(row);
    // Minutes are recomputed from the row's punches on every commit, so a row
    // whose stored minutes are stale is corrected by any commit.
    const mins = computePunchMinutes({
      entry_time: edit.entry_time, exit_time: edit.exit_time,
      scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
    });
    if (!mins) return null;
    const derived = computeDerivedFields({
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      late_minutes: mins.late_minutes, late_after_grace: mins.late_after_grace,
      early_leave_minutes: mins.early_leave_minutes, initial_status: row.initial_status,
    });
    await updateTimes({
      id: row.id,
      entry_time: edit.entry_time || null, exit_time: edit.exit_time || null,
      late_minutes: mins.late_minutes, late_after_grace: mins.late_after_grace, early_leave_minutes: mins.early_leave_minutes,
    });
    await updateEntry({
      id: row.id,
      event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
      event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
      documentation: edit.documentation, notes: edit.notes,
      discount_total_minutes: derived.discount_total_minutes,
      payroll_ready: derived.payroll_ready, status_current: derived.status_current,
    });
    return {
      status: derived.status_current,
      saved: {
        id: row.id, period_name: row.period_name, employee_name: row.employee_name, work_date: row.work_date,
        event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
        event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
        documentation: edit.documentation, notes: edit.notes, auto_notes: row.auto_notes,
        initial_status: row.initial_status, status_current: derived.status_current,
        discount_total_minutes: derived.discount_total_minutes, updated_at: '',
      },
    };
  };

  // Put a committed row back to its initial status (payroll_ready NO)
  const revertRow = async (r: CommittedRow): Promise<void> => {
    await updateEntry({
      id: r.id,
      event_type_1: r.event_type_1,
      pay_impact_1: r.pay_impact_1,
      event_type_2: r.event_type_2,
      pay_impact_2: r.pay_impact_2,
      documentation: r.documentation,
      notes: r.notes,
      discount_total_minutes: r.discount_total_minutes,
      payroll_ready: 'NO',
      status_current: r.initial_status,
    });
  };

  // Undo from the toast (AR-7): put the row back exactly as it was loaded before the
  // commit — punch times and minutes, events, impacts, doc, notes, discount, readiness
  // and status. Values are written as loaded (a NULL stays NULL).
  // The entry is written first: if the second write fails, the row is already back in
  // Action Required (payroll_ready NO) and its next commit recomputes the minutes.
  const restoreRow = async (o: EntryRow): Promise<void> => {
    await updateEntry({
      id: o.id,
      event_type_1: o.event_type_1, pay_impact_1: o.pay_impact_1,
      event_type_2: o.event_type_2, pay_impact_2: o.pay_impact_2,
      documentation: o.documentation, notes: o.notes,
      discount_total_minutes: o.discount_total_minutes,
      payroll_ready: o.payroll_ready, status_current: o.status_current,
    });
    await updateTimes({
      id: o.id,
      entry_time: o.entry_time, exit_time: o.exit_time,
      late_minutes: o.late_minutes, late_after_grace: o.late_after_grace, early_leave_minutes: o.early_leave_minutes,
    });
  };

  return { saveRow, revertRow, restoreRow };
}
```

## `src/app/lib/teramindCoverage.ts` (whole file)

```ts
// Teramind coverage warning (Process Payroll). Saul, 2026-09-25: "why report no
// Teramind info when Monday already says he was sick". A scheduled workday is only a
// coverage gap when Teramind has nothing for it AND no Monday absence form, no
// permission and no holiday explains it. Warning-only: pay is decided by the engine.
// No imports (the page passes normalizeName and fmtDay) so node tests can load it.

type Emp = { id?: number; teramind_email: string; display_name: string };
type Attendance = { employeeName: string; employeeEmail?: string; date: string; type: string };
type Permission = { employeeName: string; employeeEmail?: string; startDate: string; endDate: string };

/** Scheduled workdays (YYYY-MM-DD) with no Teramind data and nothing on Monday or the calendar explaining them. */
export function unexplainedWorkdays(
  emp: Emp,
  expectedWorkdays: string[],
  teramindDays: { has: (d: string) => boolean },
  holidayDates: Set<string>,
  attendance: Attendance[],
  permissions: Permission[],
  normalize: (s: string) => string,
  /** Normalised name or alias → employee id (ProcessPayroll's buildNameMap), as the engine uses. */
  nameMap?: Map<string, number>,
  /** Every roster teramind_email, lower-cased: an email that belongs to someone else never matches. */
  rosterEmails?: Set<string>,
): string[] {
  const empEmail = emp.teramind_email.trim().toLowerCase();
  const empName = normalize(emp.display_name);
  // Same order as the engine: this employee's email matches; someone else's email never
  // does; otherwise the name, through aliases too.
  const mine = (r: { employeeName: string; employeeEmail?: string }) => {
    const email = (r.employeeEmail ?? '').trim().toLowerCase();
    if (email && email === empEmail) return true;
    if (email && rosterEmails?.has(email)) return false;
    const n = normalize(r.employeeName ?? '');
    return (emp.id !== undefined && nameMap?.get(n) === emp.id) || n === empName;
  };
  const absent = new Set(attendance.filter(r => r.type === 'Absence' && mine(r)).map(r => r.date.slice(0, 10)));
  const perms = permissions.filter(mine);
  return expectedWorkdays.filter(d =>
    !teramindDays.has(d) && !holidayDates.has(d) && !absent.has(d) &&
    !perms.some(p => d >= p.startDate.slice(0, 10) && d <= p.endDate.slice(0, 10)));
}
```

## `src/actions/loadCommittedEntries.ts` (whole file)

```ts
import { action } from '@uibakery/data';

function loadCommittedEntries() {
  return action('loadCommittedEntries', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT pe.id, pe.period_name, e.display_name AS employee_name, pe.work_date,
             pe.event_type_1, pe.pay_impact_1, pe.event_type_2, pe.pay_impact_2,
             pe.documentation, pe.notes, pe.auto_notes,
             pe.initial_status, pe.status_current, pe.discount_total_minutes,
             (pe.updated_at AT TIME ZONE 'America/Panama')::text AS updated_at
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE (COALESCE({{params.periodName}}, '') = '' OR pe.period_name = {{params.periodName}})
        AND pe.initial_status IN ('RED','YELLOW')
        AND pe.payroll_ready = 'YES'
        AND pe.deleted_at IS NULL
      ORDER BY pe.updated_at DESC, e.display_name, pe.work_date;
    `,
  });
}

export default loadCommittedEntries;
```

## 5. `src/app/pages/ProcessPayroll.tsx`: two exact replacements, nothing else

1. Replace
   `      const holidayDates = new Set((holidays as { date: string }[]).map(h => String(h.date).slice(0, 10)));`
   with
   ```ts
         const holidayDates = new Set((holidays as { date: string }[]).map(h => String(h.date).slice(0, 10)));
         const coverageNames = buildNameMap();
         const rosterEmails = new Set((employees as Employee[]).map(e => (e.teramind_email || '').trim().toLowerCase()).filter(Boolean));
   ```
2. Replace
   `        const gaps = unexplainedWorkdays(emp, expectedWorkdays, dayMap, holidayDates, attendance, permissions, normalizeName);`
   with
   `        const gaps = unexplainedWorkdays(emp, expectedWorkdays, dayMap, holidayDates, attendance, permissions, normalizeName, coverageNames, rosterEmails);`

## 6. `src/app/pages/ActionRequired.tsx`: two exact replacements, nothing else

1. Replace `<ArCommitBar someSelected={bulk} selectedCount={selectedCount} selectedSize={selected.size}`
   with `<ArCommitBar someSelected={bulk} selectedCount={selectedCount} selectedSize={selectedCount}`
2. Replace `isSelected={isSelected} selectedSize={selected.size}`
   with `isSelected={isSelected} selectedSize={selectedCount}`

## Report
- Byte size of the six files; the changed lines in sections 5 and 6 as they now read.
- Confirm no other file changed.
