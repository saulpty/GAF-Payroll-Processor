import { Check, Send } from 'lucide-react';
import { TimeInput } from '@/app/components/TimeInput';
import { Combobox } from '@/app/components/ds/Combobox';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtShift } from '@/app/lib/fmtTime';
import { fmtMinutes, IMPACT_DOT, impactTone, missingEvent } from './arLogic';
import { rowDiscount } from './arDiscount';
import type { EditState, EntryRow } from './arTypes';

const THIS_YEAR = toLocalYMD(new Date()).slice(0, 4);
const td = 'px-2 py-1.5 border-b border-slate-100';
const impactDot = (v: string) => IMPACT_DOT[impactTone(v)];
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
  // Live Late/Early and what a commit would deduct: the save's own maths (shared with ArConfirm).
  const { late, early, discount } = rowDiscount(row, edit);
  const day = fmtDay(row.work_date.slice(0, 10), THIS_YEAR);
  const who = `${row.employee_name} ${row.work_date.slice(0, 10)}`;
  const broadcasting = isSelected && selectedSize > 1;
  const tint = isSelected ? 'bg-warm-tint' : row.initial_status === 'RED' ? 'bg-status-red-tint' : 'bg-status-yellow-tint';
  const bar = isSelected ? 'shadow-[inset_3px_0_0_var(--warm)]' : '';
  const pick = (field: keyof EditState) => (v: string) => onEdit(row.id, field, v, row, visibleRows);
  const combo = (field: keyof EditState, value: string, options: string[], label: string, invalid = false, toneOf?: (v: string) => string) => (
    <div className={broadcasting ? 'rounded-md ring-1 ring-warm-ring' : ''} title={broadcasting ? `Applies to all ${selectedSize} selected rows` : undefined}>
      <Combobox value={value} options={options} onChange={pick(field)} ariaLabel={`${label}, ${who}`}
        invalid={invalid} flashKey={invalid ? 1 : 0} className="w-full" toneOf={toneOf} />
    </div>
  );

  return (
    <tr className={`${tint} hover:brightness-[0.98] text-[13px] text-slate-800`}>
      <td className={`${td} sticky left-0 z-10 w-10 ${tint} ${bar}`}>
        <input type="checkbox" checked={isSelected} aria-label={`Select ${who}`}
          onChange={() => {}} onClick={e => onToggle(row.id, rowIndex, e.shiftKey)}
          className="h-4 w-4 rounded border-slate-400 accent-[var(--warm)] cursor-pointer" />
      </td>
      <td className={`${td} sticky left-10 z-10 ${tint}`} style={{ width: 176, minWidth: 176, maxWidth: 176 }}>
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-medium" title={row.employee_name}>{row.employee_name}</span>
            {/* The day stays in view while scrolling right to Event / Impact (AR-13). */}
            <span className="block text-[11px] text-slate-500" aria-hidden="true">{day}</span>
          </span>
          {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warm" title="Unsaved changes"><span className="sr-only">Unsaved changes</span></span>}
          {canCommitOne && (
            <button type="button" onClick={() => onCommitOne(row)} title="Commit this row to Green"
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-0.5 text-[11px] font-semibold text-warm-ink hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
              <Send className="w-3 h-3" />Commit
            </button>
          )}
        </div>
      </td>
      {showPeriod && <td className={`${td} whitespace-nowrap text-slate-600`} style={{ width: 110 }}>{row.period_name}</td>}
      <td className={`${td} whitespace-nowrap text-slate-700`} style={{ width: 96 }}>{day}</td>
      <td className={td} style={{ width: 88, minWidth: 88 }}>
        <TimeInput className={timeBox} value={edit.entry_time} placeholder="9:00 AM" ariaLabel={`In, ${who}`} onChange={v => onEdit(row.id, 'entry_time', v, row)} />
      </td>
      <td className={td} style={{ width: 88, minWidth: 88 }}>
        <TimeInput className={timeBox} value={edit.exit_time} placeholder="5:00 PM" ariaLabel={`Out, ${who}`} onChange={v => onEdit(row.id, 'exit_time', v, row)} />
      </td>
      <td className={`${td} whitespace-nowrap text-[12px] text-slate-500`} style={{ width: 150 }}>{fmtShift(row.work_days, row.scheduled_start, row.scheduled_end)}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${late > 0 ? 'text-slate-800' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(late) || '—'}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${early > 0 ? 'text-slate-800' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(early) || '—'}</td>
      <td className={`${td} text-right`} style={{ width: 104 }}>
        {discount.tone === 'deduct' && <span className="inline-block whitespace-nowrap rounded-full bg-status-red-tint px-2 py-0.5 text-[12px] font-semibold tabular-nums text-status-red-ink ring-1 ring-status-red-fill">{discount.text}</span>}
        {discount.tone === 'paid' && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-status-green-fill px-2 py-0.5 text-[12px] font-semibold text-status-green-ink"><Check className="w-3 h-3" />Paid</span>}
        {discount.tone === 'none' && <span className="text-slate-300">—</span>}
      </td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_1', edit.event_type_1, eventOpts, 'Event 1', needsEvent === 1)}
        {needsEvent === 1 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_1', edit.pay_impact_1, impactOptions, 'Impact 1', false, impactDot)}</td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_2', edit.event_type_2, eventOpts, 'Event 2', needsEvent === 2)}
        {needsEvent === 2 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_2', edit.pay_impact_2, impactOptions, 'Impact 2', false, impactDot)}</td>
      <td className={td} style={{ width: 140, minWidth: 140 }}>{combo('documentation', edit.documentation, docOpts, 'Doc')}</td>
      <td className={`${td} text-[12px] text-slate-500`} style={{ maxWidth: 220 }}>
        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
      </td>
      <td className={td} style={{ minWidth: 180 }}>
        <input className="w-full h-7 rounded-md border border-slate-300 bg-white px-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
          value={edit.notes} placeholder="Add a note" aria-label={`Notes, ${who}`} onChange={e => onEdit(row.id, 'notes', e.target.value, row)} />
      </td>
    </tr>
  );
}
