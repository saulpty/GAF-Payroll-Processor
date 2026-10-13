import type { ReactNode } from 'react';
import type { ReportRow } from '@/app/lib/attendanceReportTypes';
import { fmtDayLong } from '@/app/lib/fmtDay';
import { flagNotes, formTiming } from '@/app/lib/reportDayText';
import MobileSheet from '@/app/components/mobile/MobileSheet';
import { VERDICT_LABEL, fmtMins, time } from './AttendanceReportStrips';

type Props = { row: ReportRow | null; onClose: () => void };

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-900 break-words">{children}</dd>
    </div>
  );
}

/** Phone only: one day of Attendance → Reports written out in full. Reading only. */
export default function ReportDaySheet({ row, onClose }: Props) {
  const notes = row ? flagNotes(row.flags) : [];
  return (
    <MobileSheet
      open={row !== null}
      onClose={onClose}
      size="partial"
      title={row ? fmtDayLong(row.date) : ''}
      subtitle={row ? row.employeeName : undefined}
    >
      {row && (
        <div className="px-4 pt-1 pb-5 text-[13px] leading-5">
          <dl>
            <Line label="Verdict"><span className="font-semibold">{VERDICT_LABEL[row.verdict]}</span></Line>
            <Line label="Scheduled">{time(row.scheduledStart)}</Line>
            <Line label="In → Out"><span className="tabular-nums">{time(row.entryTime)} → {time(row.exitTime)}</span></Line>
            <Line label="Late">{row.minutesLate > 0 ? fmtMins(row.minutesLate) : '—'}</Line>
            {row.coveredBy && <Line label="Covered By">{row.coveredBy.label}</Line>}
            <Line label="Form">{row.form ? row.form.type : '—'}</Line>
            {row.form && <Line label="Sent">{formTiming(row.form.onTime)}</Line>}
            {row.form && row.form.reason && <Line label="Reason">{row.form.reason}</Line>}
          </dl>
          {notes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2 text-slate-700">
              {notes.map(n => (
                <li key={n} className="flex items-start gap-2">
                  <span className="text-slate-400" aria-hidden="true">ⓘ</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </MobileSheet>
  );
}
