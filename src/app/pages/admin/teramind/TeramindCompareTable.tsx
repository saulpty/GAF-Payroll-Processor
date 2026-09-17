import { fmtMinutes } from '@/app/lib/teramindCompare';
import type { CompareRow, CompareVerdict } from '@/app/lib/teramindCompare';

export type TableItem = { row: CompareRow; verdict: CompareVerdict };

type Props = {
  rows: TableItem[];
  totalCount: number;
};

const MAX_ROWS = 500;

function fmtDiff(d: number | null): string {
  if (d == null) return '—';
  return d > 0 ? `+${d}` : String(d);
}

function diffColor(abs: number | null): string {
  if (abs == null) return '';
  if (abs > 30) return 'text-red-600 font-medium';
  if (abs > 5)  return 'text-amber-600';
  return 'text-slate-500';
}

function fmtLongest(s: number | null): string {
  if (s == null) return '—';
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  return `${h}:${m}`;
}

const HEADERS = [
  'Date','Employee','Period','Payroll In','Teramind In','Δ In',
  'Payroll Out','Teramind Out','Δ Out','Records','Longest','Event','Status','Edited',
];

export default function TeramindCompareTable({ rows, totalCount }: Props) {
  const rendered = rows.slice(0, MAX_ROWS);

  return (
    <>
      {totalCount > MAX_ROWS && (
        <p className="text-xs text-amber-700">
          Showing first {MAX_ROWS} of {totalCount} rows matching current filters.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50">
              {HEADERS.map(h => (
                <th key={h} className="px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap border-b border-slate-100 sticky top-0 bg-slate-50">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rendered.map(({ row: r, verdict: v }, i) => (
              <tr key={i} className="hover:bg-slate-50 border-b border-slate-50">
                <td className="px-2 py-1 whitespace-nowrap font-mono text-slate-600">{r.day}</td>
                <td className="px-2 py-1 whitespace-nowrap max-w-[130px] truncate">{r.name}</td>
                <td className="px-2 py-1 whitespace-nowrap text-slate-400">{r.period_name ?? '—'}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.pay_entry ?? '—'}</td>
                <td className="px-2 py-1 whitespace-nowrap">{fmtMinutes(r.tm_entry_min)}</td>
                <td className={`px-2 py-1 whitespace-nowrap text-right ${diffColor(v.entryDiff != null ? Math.abs(v.entryDiff) : null)}`}>
                  {fmtDiff(v.entryDiff)}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">{r.pay_exit ?? '—'}</td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {fmtMinutes(r.tm_exit_min)}{r.tm_exit_next_day ? ' +1d' : ''}
                </td>
                <td className={`px-2 py-1 whitespace-nowrap text-right ${diffColor(v.exitDiff != null ? Math.abs(v.exitDiff) : null)}`}>
                  {fmtDiff(v.exitDiff)}
                </td>
                <td className="px-2 py-1 text-right">
                  {r.sessions ?? '—'}
                  {r.has_manual && (
                    <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-purple-100 text-purple-700 font-medium">manual</span>
                  )}
                </td>
                <td className="px-2 py-1 whitespace-nowrap">
                  {fmtLongest(r.longest_s)}
                  {v.longSession && (
                    <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-amber-100 text-amber-700 font-medium">long</span>
                  )}
                </td>
                <td className="px-2 py-1 whitespace-nowrap text-slate-400 max-w-[80px] truncate">{r.event_type_1 ?? '—'}</td>
                <td className="px-2 py-1 whitespace-nowrap">{r.initial_status ?? '—'}</td>
                <td className="px-2 py-1">
                  {r.touched_after_run && (
                    <span className="px-1 py-0.5 rounded text-[9px] bg-blue-100 text-blue-700 font-medium">edited</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
