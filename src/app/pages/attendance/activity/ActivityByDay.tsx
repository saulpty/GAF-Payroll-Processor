import { Download } from 'lucide-react';
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import SourceBadge from './SourceBadge';

type Props = { days: ActivityDay[]; dateFrom: string; dateTo: string };

const TH = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap';
const TD = 'px-3 py-2 text-sm text-slate-700';

function escape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(days: ActivityDay[], dateFrom: string, dateTo: string) {
  const header = ['employee', 'date', 'first', 'last', 'active_minutes', 'breaks_minutes', 'why', 'source'].join(',');
  const body = days.map(d => {
    const first = d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '';
    const last = d.shownLastMin !== null ? (fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')) : '';
    const why = d.why ? d.why.label : '';
    const source = !d.official ? 'Live' : d.edited ? 'Official, Edited' : 'Official';
    return [d.employeeName, d.date, first, last, d.activeMin, d.breaksMin, why, source].map(escape).join(',');
  }).join('\n');

  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity_${dateFrom}_${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActivityByDay({ days, dateFrom, dateTo }: Props) {
  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={() => exportCsv(days, dateFrom, dateTo)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <table className="w-full text-left divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className={TH}>Employee</th>
              <th className={TH}>Date</th>
              <th className={TH}>First – Last</th>
              <th className={TH}>Active</th>
              <th className={TH}>Breaks</th>
              <th className={TH}>Why</th>
              <th className={TH}>Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {days.map(d => (
              <tr key={`${d.employeeId}-${d.date}`} className="hover:bg-slate-50 transition-colors">
                <td className={TD}>
                  <div className="font-medium">{d.employeeName}</div>
                  <div className="text-xs text-slate-400">{d.role}</div>
                </td>
                <td className={TD}>{fmtDayShort(d.date)}</td>
                <td className={TD}>
                  {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                  {' – '}
                  {d.shownLastMin !== null ? (fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')) : '—'}
                </td>
                <td className={TD}>{fmtDuration(d.activeMin)}</td>
                <td className={TD}>
                  {d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}
                </td>
                <td className={TD}>
                  {d.why ? <WhyChipBadge chip={d.why} /> : null}
                </td>
                <td className={TD}>
                  <SourceBadge official={d.official} edited={d.edited} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
