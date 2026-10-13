import { X } from 'lucide-react';
import type { EmpStats } from '@/app/lib/attendanceStats';
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useIsPhone } from '@/app/lib/useIsPhone';
import MobileSheet from '@/app/components/mobile/MobileSheet';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useActivityData } from './activity/useActivityData';
import { useEmployeeStats } from './useEmployeeStats';
import AttendancePanelBody from './AttendancePanelBody';
import AttendancePanelDays from './AttendancePanelDays';
import AttendancePanelKpis from './AttendancePanelKpis';

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

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init = parts.length >= 2
    ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div className="w-11 h-11 rounded-full bg-[#2AA876]/15 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-[#2AA876]">{init}</span>
    </div>
  );
}

export function AttendancePanel({
  stats: propStats,
  onClose,
  employeeId,
  days: propDays,
  displayName,
  displayRole,
  displayManager,
}: Props) {
  const { dateFrom, dateTo } = useGlobalFilters();
  const isPhone = useIsPhone();
  const safeFrom = dateFrom || daysAgo(30);
  const safeTo   = dateTo   || toLocalYMD(new Date());

  // Always call hooks — React forbids conditional hook calls.
  const { days: hookDays, error: activityError } = useActivityData({ dateFrom: safeFrom, dateTo: safeTo });
  const { stats: hookStats } = useEmployeeStats({
    employeeId,
    email: propStats?.email,
    dateFrom: safeFrom,
    dateTo: safeTo,
  });

  const resolvedId = employeeId ?? null;
  const panelDays: ActivityDay[] = propDays
    ?? (resolvedId !== null ? hookDays.filter(d => d.employeeId === resolvedId) : []);

  // Merge: prefer prop stats (caller already computed them), fall back to hook stats
  const stats = propStats ?? hookStats;

  if (!stats && resolvedId === null) return null;

  const name     = stats?.name     ?? displayName    ?? '';
  const schedule = stats?.schedule ?? '';
  const role     = stats?.role     ?? displayRole    ?? '';
  const manager  = stats?.manager  ?? displayManager ?? '';

  // Build muted subtitle: role · schedule · Manager X
  const subtitleParts: string[] = [];
  if (role) subtitleParts.push(role);
  if (schedule && schedule !== '—') subtitleParts.push(schedule);
  if (manager) subtitleParts.push(`Manager ${manager}`);
  const subtitle = subtitleParts.join(' · ');

  const dateRangeLine = `${fmtDayShort(safeFrom)} – ${fmtDayShort(safeTo)}`;

  // On a phone the panel is a full sheet: the four headline numbers, Day by Day as rows, then the
  // seven small numbers. The charts are never rendered. The computer's panel below is unchanged.
  if (isPhone) {
    return (
      <MobileSheet
        size="full"
        open
        onClose={onClose}
        title={name || 'Employee'}
        subtitle={[subtitle, dateRangeLine].filter(Boolean).join(' · ')}
      >
        <div className="p-4 flex flex-col gap-6">
          {activityError ? (
            <p className="text-[13px] text-muted-foreground italic py-2">
              Couldn't load activity data for this range.
            </p>
          ) : (
            <>
              <AttendancePanelKpis days={panelDays} stats={stats} />
              <AttendancePanelDays days={panelDays} attendanceRows={stats?.rows ?? []} isPhone />
              {stats && <AttendancePanelBody stats={stats} isPhone />}
            </>
          )}
        </div>
      </MobileSheet>
    );
  }

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
        className="fixed top-0 right-0 bottom-0 bg-white z-50 overflow-y-auto shadow-2xl flex flex-col phone:overscroll-contain"
        style={{
          width: isPhone ? '100%' : 'clamp(520px, 55vw, 900px)',
          animation: 'slideInRight 280ms cubic-bezier(0.22, 0.68, 0, 1.1) both',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-7 py-5 flex items-start justify-between z-10 phone:px-4">
          <div className="flex items-center gap-3 min-w-0">
            {name && <Initials name={name} />}
            <div className="min-w-0">
              <div className="text-xl font-bold tracking-tight leading-tight">{name}</div>
              {subtitle && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>
              )}
              <div className="text-[11px] text-muted-foreground/70 mt-0.5">{dateRangeLine}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close employee panel"
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-border transition-colors shrink-0 ml-4 phone:w-11 phone:h-11"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-7 flex flex-col gap-6 phone:p-4">
          {activityError ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Couldn't Load Activity Data For This Range.
            </p>
          ) : (
            <>
              {/* Activity KPI tiles */}
              <AttendancePanelKpis days={panelDays} stats={stats} />

              {/* Attendance KPIs + arrival chart + Donuts */}
              {stats && <AttendancePanelBody stats={stats} />}

              {/* Day By Day — single merged table */}
              <AttendancePanelDays days={panelDays} attendanceRows={stats?.rows ?? []} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
