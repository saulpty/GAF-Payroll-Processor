import { useState, useMemo } from 'react';
import { Activity, AlertCircle, Info } from 'lucide-react';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { fmtDuration } from '@/app/lib/teramindToday';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useActivityData } from './useActivityData';
import ActivityNeedsLook from './ActivityNeedsLook';
import ActivityByEmployee from './ActivityByEmployee';
import ActivityByDay from './ActivityByDay';

type ViewMode = 'byEmployee' | 'byDay';

function today() { return toLocalYMD(new Date()); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return toLocalYMD(d); }

function SummaryTile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[110px]">
      <span className={`text-2xl font-bold tabular-nums ${accent ?? 'text-slate-800'}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{label}</span>
    </div>
  );
}

export default function AttendanceActivity() {
  const { dateFrom, dateTo } = useGlobalFilters();

  const safeFrom = dateFrom || daysAgo(7);
  const safeTo   = dateTo   || today();

  // Default view: By Day when exactly 1 day, By Employee otherwise
  const isOneDay = safeFrom === safeTo;
  const [viewMode, setViewMode] = useState<ViewMode>(isOneDay ? 'byDay' : 'byEmployee');

  const { days, byEmployee, totals, loading, error, configFallbacks } = useActivityData({
    dateFrom: safeFrom,
    dateTo: safeTo,
  });

  const filteredNeedsLook = useMemo(() => days.filter(d => d.needsLook), [days]);

  const avgActiveLabel = totals.avgActiveMin !== null ? fmtDuration(totals.avgActiveMin) : '—';

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto px-4 py-4">

        {/* Config fallback notice */}
        {configFallbacks.length > 0 && !loading && (
          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 mb-4">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
            Using default thresholds for: {configFallbacks.join(', ')}. Configure in Admin → Rules & Config.
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Error loading activity data. Check the database connection.
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Loading activity data…
          </div>
        )}

        {!loading && (
          <>
            {/* KPI tiles */}
            <div className="flex flex-wrap gap-3 mb-4">
              <SummaryTile label="Avg Active Time"  value={avgActiveLabel}   accent="text-[#2AA876]" />
              <SummaryTile label="Days With Work"   value={totals.daysWorked} />
              <SummaryTile label="Needs A Look"     value={totals.needsLook}  accent={totals.needsLook > 0 ? 'text-amber-600' : undefined} />
              <SummaryTile label="Late Arrivals"    value={totals.lateArrivals} />
            </div>

            {/* By Employee / By Day switch */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex rounded-lg border border-border overflow-hidden shadow-sm">
                <button
                  onClick={() => setViewMode('byEmployee')}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewMode === 'byEmployee' ? 'bg-[#2AA876] text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  By Employee
                </button>
                <button
                  onClick={() => setViewMode('byDay')}
                  className={[
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l',
                    viewMode === 'byDay' ? 'bg-[#2AA876] text-white' : 'bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  By Day
                </button>
              </div>
            </div>

            {/* Needs A Look list */}
            <ActivityNeedsLook days={filteredNeedsLook} />

            {/* Main table */}
            {viewMode === 'byEmployee'
              ? <ActivityByEmployee byEmployee={byEmployee} />
              : <ActivityByDay days={days} dateFrom={safeFrom} dateTo={safeTo} />
            }

            {/* Footer */}
            <p className="text-xs text-slate-400 text-center mt-6 pb-2">
              Data Updates Every 15 Minutes · Times In US Eastern
            </p>
          </>
        )}
      </div>
    </div>
  );
}
