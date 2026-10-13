import { AlertCircle, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MobileRow from '@/app/components/mobile/MobileRow';
import { useViewer } from '@/app/context/ViewerContext';
import { fmtDay, fmtLeaveDates } from '@/app/lib/fmtDay';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';
import { recordability } from '@/app/lib/ptoPayrollMatch';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import { daysLabel, recordBlockedText } from '@/app/lib/ptoPhone';
import type { DialogMode } from './RecordApprovalDialog';
import type { SubItem } from './PtoSubRow';
import PtoPayrollCell from './PtoPayrollCell';
import PtoVerdictCell from './PtoVerdictCell';

type Item = SubItem & { match: PayrollMatch };

interface Handlers {
  onOpenDialog: (m: DialogMode) => void;
  onWithdraw: (id: number, days: number) => void;
  onRestore: (id: number) => void;
}

interface Props extends Handlers {
  /** Built by PtoBreakdown: the same list, in the same order, as the table's sub-rows. */
  items: Item[];
  today: string;
  loading: boolean;
}

const PILL = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap';
const LABEL = 'mb-0.5 text-[12px] font-semibold text-slate-600';
const BTN = 'h-11 flex-1 text-[14px]';

/** Super users only. The same four actions as the table's last column, with the same rules. */
function RequestActions({ item, today, onOpenDialog, onWithdraw, onRestore }: Handlers & { item: Item; today: string }) {
  const withdrawn = item.kind === 'recorded' && item.status === 'withdrawn';
  const rec = recordability(item.match, item.return_on, today, defaultTotalDays);
  const blocked = recordBlockedText(rec.reason);
  return (
    <div className="flex flex-wrap gap-2">
      {withdrawn && (
        <Button variant="outline" className={BTN} onClick={() => onRestore(item.id!)}>
          <RotateCcw className="w-4 h-4" />
          Restore
        </Button>
      )}
      {item.kind === 'pending' && (
        <>
          <Button
            className={`${BTN} bg-warm text-warm-ink hover:bg-warm hover:brightness-95 font-semibold`}
            onClick={() => onOpenDialog({ kind: 'record', request: item.request, match: item.match })}
            disabled={!rec.ok}
          >
            <Plus className="w-4 h-4" />
            Record
          </Button>
          {blocked && (
            <p className="basis-full text-[12px] text-slate-500">{blocked}</p>
          )}
        </>
      )}
      {item.kind === 'recorded' && !withdrawn && (
        <>
          <Button
            variant="outline"
            className={BTN}
            onClick={() => onOpenDialog({ kind: 'edit', row: item.request, match: item.match })}
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
          {item.status === 'recorded' && (
            <Button variant="outline" className={BTN} onClick={() => onWithdraw(item.id!, item.days)}>
              <Trash2 className="w-4 h-4" />
              Withdraw
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Super users only: what payroll says, the evidence, where the row came from, and the actions. */
function SuperDetail({ item, today, thisYear, ...handlers }: Handlers & { item: Item; today: string; thisYear: string }) {
  const sourceNote = item.kind === 'pending' ? 'from Monday board'
    : item.source === 'excel_import' ? 'from Excel'
    : item.source === 'manual' ? 'added manually'
    : '';
  return (
    <>
      {item.match.state && (
        <div>
          <div className={LABEL}>What Payroll Says</div>
          <PtoVerdictCell
            match={item.match}
            leaveType={item.leave_type}
            requestDays={item.days}
            leaveOn={item.leave_on}
            thisYear={thisYear}
            today={today}
          />
        </div>
      )}
      {item.match.state && (
        <div>
          <div className={LABEL}>Evidence</div>
          <div className="text-[12px] [&>span]:text-left">
            <PtoPayrollCell match={item.match} thisYear={thisYear} />
          </div>
        </div>
      )}
      {sourceNote && <p className="text-[12px] text-slate-500">{sourceNote}</p>}
      <RequestActions item={item} today={today} {...handlers} />
    </>
  );
}

/** The requests of one employee on a phone. Reading only, unless the viewer is a super user. */
export default function PtoRequestRows({ items, today, loading, onOpenDialog, onWithdraw, onRestore }: Props) {
  const { isSuper } = useViewer();
  const thisYear = today.slice(0, 4);

  if (items.length === 0) {
    return (
      <p className="border-t border-slate-200 bg-white px-4 py-4 text-center text-[13px] text-slate-500">
        Nothing recorded or pending
      </p>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white" aria-busy={loading}>
      {items.map((item, i) => {
        const withdrawn = item.kind === 'recorded' && item.status === 'withdrawn';
        const fh = item.leave_type === 'floating_holiday';
        const invalid = Boolean(item.match.invalidDates);
        return (
          <MobileRow
            key={item.kind === 'pending'
              ? `p-${item.request?.monday_item_id ?? i}`
              : `r-${item.id}`}
            muted={withdrawn}
            title={
              <>
                <span aria-hidden="true">{fh ? '⭐' : '🌴'}</span>
                {' '}{fh ? 'Floating Holiday' : 'PTO'} · {daysLabel(item.days)}
              </>
            }
            right={
              item.kind === 'pending'
                ? <span className={`${PILL} bg-status-yellow-fill text-status-yellow-ink`}>Pending</span>
                : withdrawn
                  ? <span className={`${PILL} bg-status-red-fill text-status-red-ink line-through`}>Withdrawn</span>
                  : <span className={`${PILL} bg-status-green-fill text-status-green-ink`}>Recorded</span>
            }
            facts={
              <>
                <span>{fmtLeaveDates(item.leave_on, item.return_on, thisYear)}</span>
                {item.return_on && <span>back {fmtDay(item.return_on, thisYear)}</span>}
                {withdrawn && item.withdrawnAt && <span>withdrawn {fmtDay(item.withdrawnAt, thisYear)}</span>}
              </>
            }
          >
            {(invalid || item.comments || isSuper) && (
              <div className="space-y-3 bg-white px-4 pb-3 text-[13px]">
                {invalid && (
                  <p className="flex items-start gap-1.5 rounded-md bg-status-red-fill px-2.5 py-1.5 text-[12px] font-medium text-status-red-ink">
                    <AlertCircle className="mt-0.5 w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Return is before leave — fix on Monday
                  </p>
                )}
                {item.comments && (
                  <p className="break-words text-slate-600">
                    <span className="font-medium text-slate-700">GAF comments: </span>
                    {item.comments}
                  </p>
                )}
                {isSuper && (
                  <SuperDetail
                    item={item}
                    today={today}
                    thisYear={thisYear}
                    onOpenDialog={onOpenDialog}
                    onWithdraw={onWithdraw}
                    onRestore={onRestore}
                  />
                )}
              </div>
            )}
          </MobileRow>
        );
      })}
    </div>
  );
}
