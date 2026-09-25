import { CheckSquare, Square } from 'lucide-react';
import { TimeInput } from '@/app/components/TimeInput';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import { BroadcastSelect } from './ArBits';
import type { EditState, EntryRow } from './arTypes';

/** One editable row of the work table. Split out of ActionRequired.tsx, AR-1. */
export function ArRow({
  row, rowIndex, edit, dirty, isSelected, selectedSize, showPeriod,
  eventOpts, impactOptions, docOpts, visibleRows, onToggle, onEdit,
}: {
  row: EntryRow; rowIndex: number; edit: EditState; dirty: boolean;
  isSelected: boolean; selectedSize: number; showPeriod: boolean;
  eventOpts: string[]; impactOptions: string[]; docOpts: string[];
  visibleRows: EntryRow[];
  onToggle: (id: number, index: number, shiftKey: boolean) => void;
  onEdit: (id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => void;
}) {
  const live = dirty ? computePunchMinutes({
    entry_time: edit.entry_time, exit_time: edit.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  }) : null;
  const lateShown = live ? live.late_minutes : row.late_minutes;
  const earlyShown = live ? live.early_leave_minutes : row.early_leave_minutes;
  const broadcasting = isSelected && selectedSize > 1;
  const rowBg = isSelected
    ? 'bg-blue-50'
    : dirty
      ? row.initial_status === 'RED' ? 'bg-red-50' : 'bg-amber-50/70'
      : row.initial_status === 'RED' ? 'bg-[#FFF0F0]' : 'bg-[#FFFBEB]';

  return (
    <tr className={`${rowBg} border-b hover:brightness-[0.97] transition-colors ${isSelected ? 'ring-1 ring-inset ring-blue-300' : ''}`}>
      {/* Checkbox */}
      <td className={`px-2 py-2 w-8 border-r sticky left-0 z-10 ${rowBg}`}>
        <button onClick={e => onToggle(row.id, rowIndex, e.shiftKey)} className="flex items-center justify-center w-full">
          {isSelected
            ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            : <Square className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />}
        </button>
      </td>
      {/* Frozen employee */}
      <td className={`px-3 py-2 font-medium whitespace-nowrap border-r sticky left-8 z-10 ${rowBg}`}>
        <span
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          onClick={e => onToggle(row.id, rowIndex, e.shiftKey)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); onToggle(row.id, rowIndex, e.shiftKey); } }}
          className="cursor-pointer hover:text-blue-700 transition-colors"
        >{row.employee_name}</span>
      </td>
      {showPeriod && <td className="px-3 py-1.5 border-r whitespace-nowrap text-slate-600">{row.period_name}</td>}
      <td className="px-3 py-2 whitespace-nowrap border-r font-mono text-slate-700">{row.work_date.slice(0, 10)}</td>
      {/* Entry/Exit */}
      <td className="px-1 py-1.5 border-r w-24 bg-blue-50/40" style={{ width: 112, minWidth: 112 }}>
        <TimeInput className="w-full border rounded px-1 py-1 text-xs bg-white font-mono"
          value={edit.entry_time} placeholder="9:00 AM"
          onChange={v => onEdit(row.id, 'entry_time', v, row)} />
      </td>
      <td className="px-1 py-1.5 border-r w-24 bg-blue-50/40" style={{ width: 112, minWidth: 112 }}>
        <TimeInput className="w-full border rounded px-1 py-1 text-xs bg-white font-mono"
          value={edit.exit_time} placeholder="5:00 PM"
          onChange={v => onEdit(row.id, 'exit_time', v, row)} />
      </td>
      <td className="px-3 py-2 whitespace-nowrap border-r text-slate-500 text-[11px]">{row.scheduled_start}–{row.scheduled_end}</td>
      <td className="px-3 py-2 text-center border-r">
        {lateShown > 0 ? <span className={`font-semibold ${live && lateShown !== row.late_minutes ? 'text-amber-600' : 'text-red-700'}`}>{lateShown}</span> : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-center border-r">
        {earlyShown > 0 ? <span className={`font-semibold ${live && earlyShown !== row.early_leave_minutes ? 'text-amber-600' : 'text-orange-600'}`}>{earlyShown}</span> : <span className="text-slate-300">—</span>}
      </td>
      {/* Event 1 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.event_type_1} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'event_type_1', v, row, visibleRows)}
          placeholder="— none —" options={eventOpts} />
      </td>
      {/* Impact 1 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.pay_impact_1} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'pay_impact_1', v, row, visibleRows)}
          placeholder="— pick —" options={impactOptions} />
      </td>
      {/* Event 2 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.event_type_2} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'event_type_2', v, row, visibleRows)}
          placeholder="— none —" options={eventOpts} />
      </td>
      {/* Impact 2 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.pay_impact_2} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'pay_impact_2', v, row, visibleRows)}
          placeholder="— pick —" options={impactOptions} />
      </td>
      {/* Doc */}
      <td className="px-2 py-1.5 border-r min-w-28">
        <BroadcastSelect value={edit.documentation} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'documentation', v, row, visibleRows)}
          placeholder="—" options={docOpts} />
      </td>
      {/* Auto-notes */}
      <td className="px-3 py-2 border-r text-slate-500 max-w-52 text-[11px]">
        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
      </td>
      {/* Notes */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <input className="w-full border rounded px-1.5 py-1 text-xs bg-white" value={edit.notes}
          placeholder="add note…" onChange={e => onEdit(row.id, 'notes', e.target.value, row)} />
      </td>
    </tr>
  );
}
