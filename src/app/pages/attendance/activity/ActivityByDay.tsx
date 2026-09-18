import { useState } from 'react';
import { Download } from 'lucide-react';
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import WhyChipBadge from './WhyChipBadge';
import SourceBadge from './SourceBadge';
import GhostMark from './GhostMark';
import DataTable from '@/app/components/DataTable';
import type { Col } from '@/app/components/DataTable';

type SortKey = 'employeeName' | 'date' | 'shownFirstMin' | 'shownLastMin' | 'activeMin' | 'breaksMin';

type Props = { days: ActivityDay[]; dateFrom: string; dateTo: string };

const COLUMNS: Col<ActivityDay>[] = [
  { key: 'employeeName',  label: 'Employee' },
  { key: 'date',          label: 'Date' },
  { key: 'shownFirstMin', label: 'Entry' },
  { key: 'shownLastMin',  label: 'Exit' },
  { key: 'activeMin',     label: 'Active' },
  { key: 'breaksMin',     label: 'Breaks' },
  { key: 'why',           label: 'Why',    sortable: false },
  { key: 'official',      label: 'Source', sortable: false },
];

function escape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(days: ActivityDay[], dateFrom: string, dateTo: string) {
  const header = ['employee', 'date', 'entry', 'early_record_ignored', 'exit', 'active_minutes', 'breaks_minutes', 'why', 'source'].join(',');
  const body = days.map(d => {
    const entry = d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '';
    const earlyIgnored = d.ghostMin !== null ? fmtClock(d.ghostMin) : '';
    const exit  = d.shownLastMin  !== null ? (fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')) : '';
    const why   = d.why ? d.why.label : '';
    const source = !d.official ? 'Live' : d.edited ? 'Official, Edited' : 'Official';
    return [d.employeeName, d.date, entry, earlyIgnored, exit, d.activeMin, d.breaksMin, why, source].map(escape).join(',');
  }).join('\n');

  const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity_${dateFrom}_${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function sortDays(list: ActivityDay[], key: SortKey, dir: 'asc' | 'desc'): ActivityDay[] {
  return [...list].sort((a, b) => {
    let av: number | string | null, bv: number | string | null;
    if (key === 'employeeName') { av = a.employeeName; bv = b.employeeName; }
    else if (key === 'date') { av = a.date; bv = b.date; }
    else if (key === 'shownFirstMin') { av = a.shownFirstMin ?? -1; bv = b.shownFirstMin ?? -1; }
    else if (key === 'shownLastMin')  { av = a.shownLastMin  ?? -1; bv = b.shownLastMin  ?? -1; }
    else if (key === 'activeMin') { av = a.activeMin; bv = b.activeMin; }
    else { av = a.breaksMin; bv = b.breaksMin; }

    if (typeof av === 'string' && typeof bv === 'string') {
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    const an = av as number, bn = bv as number;
    return dir === 'asc' ? an - bn : bn - an;
  });
}

const TD = 'px-3 py-2 text-sm text-slate-700';

export default function ActivityByDay({ days, dateFrom, dateTo }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <span className="text-sm">No activity for these filters.</span>
      </div>
    );
  }

  const sorted = sortDays(days, sortKey, sortDir);

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

      <DataTable
        columns={COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      >
        {sorted.map(d => {
          const rowBg = d.needsLook ? 'bg-amber-50 hover:bg-amber-100/50' : 'hover:bg-slate-50';
          return (
            <tr key={`${d.employeeId}-${d.date}`} className={`${rowBg} transition-colors`}>
              <td className={TD}>
                <div className="font-medium">{d.employeeName}</div>
                <div className="text-xs text-slate-400">{d.role}</div>
              </td>
              <td className={TD}>{fmtDayShort(d.date)}</td>
              <td className={`${TD} whitespace-nowrap tabular-nums`}>
                {d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—'}
                <GhostMark ghostMin={d.ghostMin} />
              </td>
              <td className={`${TD} whitespace-nowrap tabular-nums`}>
                {d.shownLastMin !== null
                  ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
                  : '—'}
              </td>
              <td className={TD}>{fmtDuration(d.activeMin)}</td>
              <td className={TD}>
                {d.records <= 1 ? '—' : fmtDuration(d.breaksMin)}
              </td>
              <td className={TD}>
                <div className="flex flex-wrap gap-1">
                  {d.needsLook && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Needs A Look
                    </span>
                  )}
                  {d.flag === 'long_break' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      Long Break
                    </span>
                  )}
                  {d.why ? <WhyChipBadge chip={d.why} /> : null}
                </div>
              </td>
              <td className={TD}>
                <SourceBadge official={d.official} edited={d.edited} />
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}
