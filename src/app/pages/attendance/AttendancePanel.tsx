import { X, Briefcase, User } from 'lucide-react';
import type { EmpStats } from '@/app/lib/attendanceStats';
import type { ActivityDay } from '@/app/lib/activityDays';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useActivityData } from './activity/useActivityData';
import AttendancePanelBody from './AttendancePanelBody';
import AttendancePanelDays from './AttendancePanelDays';

type Props = {
  stats: EmpStats | null;
  onClose: () => void;
  employeeId?: number;
  days?: ActivityDay[];
  /** Override header fields when stats is null (e.g. opened from Today tab) */
  displayName?: string;
  displayRole?: string;
  displayManager?: string;
};

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d); }

export function AttendancePanel({ stats, onClose, employeeId, days: propDays, displayName, displayRole, displayManager }: Props) {
  const { dateFrom, dateTo } = useGlobalFilters();
  const safeFrom = dateFrom || daysAgo(30);
  const safeTo   = dateTo   || toLocalYMD(new Date());

  // Always call the hook — React forbids conditional hook calls.
  // When propDays is provided (Activity tab) we use those; otherwise filter hook output by employeeId.
  const { days: hookDays } = useActivityData({ dateFrom: safeFrom, dateTo: safeTo });

  const resolvedId = employeeId ?? null;
  const panelDays: ActivityDay[] = propDays
    ?? (resolvedId !== null ? hookDays.filter(d => d.employeeId === resolvedId) : []);

  if (!stats && resolvedId === null) return null;

  const name     = stats?.name     ?? displayName    ?? '';
  const schedule = stats?.schedule ?? '';
  const role     = stats?.role     ?? displayRole    ?? '';
  const manager  = stats?.manager  ?? displayManager ?? '';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        style={{ animation: 'fadeIn 200ms ease both' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 bg-white z-50 overflow-y-auto shadow-2xl flex flex-col"
        style={{
          width: 'clamp(520px, 55vw, 900px)',
          animation: 'slideInRight 280ms cubic-bezier(0.22, 0.68, 0, 1.1) both',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-7 py-5 flex items-start justify-between z-10">
          <div>
            <div className="text-xl font-bold tracking-tight">{name}</div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {schedule && <span className="text-sm text-muted-foreground">{schedule}</span>}
              {role && (
                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                  <Briefcase className="w-3 h-3" />
                  {role}
                </span>
              )}
              {manager && (
                <span className="flex items-center gap-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                  <User className="w-3 h-3" />
                  {manager}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close employee panel"
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors shrink-0 ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-7 flex flex-col gap-6">
          {/* Existing body: KPIs + chart + Recent Activity + Donuts */}
          {stats && <AttendancePanelBody stats={stats} />}

          {/* New: Day By Day section */}
          <AttendancePanelDays days={panelDays} />
        </div>
      </div>
    </>
  );
}
