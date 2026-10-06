# Code-review fixes: Coming Up refresh, duplicates, filters, December window; two small guards

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

From a code review of today's work (2026-10-06):
1. **Bug:** Coming Up did not refresh after Withdraw / Restore in an opened employee — it only
   listened to the dialog's save. It now also reloads on `ptoVersion`.
2. A pending Monday request whose exact dates are already recorded (e.g. added manually) showed
   twice. The loader now skips it. Each row also returns `role` and a unique `src_id` (card key).
3. Coming Up now follows the Employee and Title filters, like the table under it.
4. In December the window also covers January, so the strip is not empty before the holidays.
5. `fmtLeaveDates` returns '' when the leave date is missing (was " → Sun Aug 23").
6. SectionBar renders nothing on a route with no section and no filters (no empty white strip).

**Only these four files may change:**
- `src/actions/loadPtoUpcoming.ts` — whole file below.
- `src/app/pages/pto/PtoComingUp.tsx` — whole file below.
- `src/app/lib/fmtDay.ts` — whole file below.
- `src/app/SectionBar.tsx` — whole file below.

No other file may be touched (not `PtoTracker.tsx`, `PtoTable.tsx`, `TopNav.tsx`, `FilterBar.tsx`,
`filterRoutes.ts`, any other action, or `src/components/ui/*`).

## `src/actions/loadPtoUpcoming.ts` (whole file)

```ts
import { action } from '@uibakery/data';

// PTO + Floating Holiday that is happening now or starts on/before {{params.until}}.
// Pending = on Monday with no pto_approvals row (same test as loadPtoEmployeeDetail);
// recorded = pto_approvals.status 'recorded' (withdrawn left out). Scoped to the viewer.
// A pending request whose exact dates are already recorded (e.g. added manually) is skipped, so
// the same leave never shows twice (code review 2026-10-06). src_id keeps card keys unique.
function loadPtoUpcoming() {
  return action('loadPtoUpcoming', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT u.* FROM (
        SELECT e.id AS employee_id, e.display_name, e.role, 'm' || r.monday_item_id::text AS src_id,
               CASE WHEN r.request_type = 'Floating Holiday' THEN 'floating_holiday' ELSE 'pto' END AS leave_type,
               r.start_date::text AS leave_on, r.return_date::text AS return_on,
               NULLIF(r.total_days_requested, 'NaN'::numeric)::numeric AS total_days,
               'pending' AS status
        FROM monday_requests r
        JOIN employees e ON e.id = r.employee_id
        LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
        WHERE r.request_type IN ('PTO / Vacation','Floating Holiday')
          AND r.deleted_on_monday = false AND a.id IS NULL
          AND NOT EXISTS (SELECT 1 FROM pto_approvals x
                          WHERE x.employee_id = r.employee_id AND x.status = 'recorded'
                            AND x.leave_on = r.start_date AND x.return_on = r.return_date)
          AND r.return_date > {{params.today}}::date
          AND r.start_date <= {{params.until}}::date
          AND r.return_date >= r.start_date
          AND e.active = true
          AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.id IN (SELECT vm.employee_id FROM public.v_employee_managers vm WHERE vm.manager_name = {{params.manager}}::text))
          AND e.id IN (SELECT va.employee_id FROM public.v_employee_access va
                        WHERE va.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        UNION ALL
        SELECT e.id AS employee_id, e.display_name, e.role, 'a' || a.id::text AS src_id,
               a.leave_type::text AS leave_type,
               a.leave_on::text AS leave_on, a.return_on::text AS return_on,
               a.total_days::numeric AS total_days,
               'recorded' AS status
        FROM pto_approvals a
        JOIN employees e ON e.id = a.employee_id
        WHERE a.status = 'recorded'
          AND a.return_on > {{params.today}}::date
          AND a.leave_on <= {{params.until}}::date
          AND a.return_on >= a.leave_on
          AND e.active = true
          AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.id IN (SELECT vm.employee_id FROM public.v_employee_managers vm WHERE vm.manager_name = {{params.manager}}::text))
          AND e.id IN (SELECT va.employee_id FROM public.v_employee_access va
                        WHERE va.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ) u
      ORDER BY u.leave_on, u.display_name
    `,
  });
}

export default loadPtoUpcoming;
```

## `src/app/pages/pto/PtoComingUp.tsx` (whole file)

```tsx
import { useEffect, useRef } from 'react';
import { useLoadAction } from '@uibakery/data';
import EmptyState from '@/app/components/EmptyState';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import loadPtoUpcomingAction from '@/actions/loadPtoUpcoming';
import { fmtDay, fmtLeaveDates } from '@/app/lib/fmtDay';

// "Coming Up" on the PTO Tracker (manager meeting, 2026-10-06): who is out now,
// then who is out for the rest of the year, grouped by month. Read-only.
// Warm look (Saul approved the mockup 2026-10-06): one white card, month headings
// above their cards, "Out Now" cards on the warm tint with a Back chip.
export interface UpcomingRow {
  employee_id: number;
  display_name: string;
  role: string | null;
  src_id: string;
  leave_type: 'pto' | 'floating_holiday';
  leave_on: string;
  return_on: string;
  total_days: number | string | null;
  status: 'pending' | 'recorded';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function LeaveCard({ r, out, thisYear }: { r: UpcomingRow; out: boolean; thisYear: string }) {
  const days = Number(r.total_days) || 0;
  const fh = r.leave_type === 'floating_holiday';
  return (
    <div
      className={`shrink-0 w-56 rounded-lg border p-3 flex flex-col gap-1 ${out ? 'border-orange-200 bg-warm-tint' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-slate-900" title={r.display_name}>{r.display_name}</span>
        <span aria-hidden="true">{fh ? '⭐' : '🌴'}</span>
      </div>
      <div className="text-[13px] text-slate-800 tabular-nums whitespace-nowrap">
        {fmtLeaveDates(r.leave_on, r.return_on, thisYear)}
      </div>
      <div className="text-[12px] text-slate-500 whitespace-nowrap">
        {fh ? 'Floating Holiday' : 'PTO'}{days > 0 ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}
        {r.status === 'pending' ? ' · Pending' : ''}
      </div>
      {out ? (
        <span className="self-start mt-0.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-warm-text ring-1 ring-inset ring-orange-200 whitespace-nowrap">
          Back {fmtDay(r.return_on, thisYear)}
        </span>
      ) : (
        <div className="text-[12px] text-slate-500 whitespace-nowrap">Back {fmtDay(r.return_on, thisYear)}</div>
      )}
    </div>
  );
}

function GroupHeading({ label, count, warm }: { label: string; count?: number; warm?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 whitespace-nowrap">
      {warm && <span className="w-2 h-2 rounded-full bg-warm" aria-hidden="true" />}
      {label}
      {count !== undefined && <span className="font-medium text-slate-400">{count}</span>}
    </div>
  );
}

export default function PtoComingUp({ today, refreshKey }: { today: string; refreshKey: number }) {
  const { manager, employee, role, ptoVersion } = useGlobalFilters();
  const { viewAs } = useViewer();
  const thisYear = today.slice(0, 4);
  // Rest of the year; in December also show January so the strip is not empty before the holidays.
  const until = today.slice(5, 7) === '12' ? `${Number(thisYear) + 1}-01-31` : `${thisYear}-12-31`;

  const [raw, loading, error, reload] = useLoadAction(
    loadPtoUpcomingAction,
    [] as UpcomingRow[],
    { today, until, manager: manager || null, viewAs },
  );

  // Reload after the dialog saves (refreshKey) and after Withdraw / Restore (ptoVersion).
  const refreshRef = useRef(`${refreshKey}|${ptoVersion}`);
  useEffect(() => {
    const k = `${refreshKey}|${ptoVersion}`;
    if (refreshRef.current !== k) {
      refreshRef.current = k;
      reload();
    }
  }, [refreshKey, ptoVersion, reload]);

  // Same Employee / Title filters as the table below (Manager is applied in the loader).
  const rows = ((raw as UpcomingRow[]) ?? [])
    .filter(r =>
      (!employee || String(r.employee_id) === employee || r.display_name.toLowerCase().includes(employee.toLowerCase())) &&
      (!role || (r.role ?? '').toLowerCase().includes(role.toLowerCase())))
    .map(r => ({
      ...r,
      leave_on: String(r.leave_on ?? '').slice(0, 10),
      return_on: String(r.return_on ?? '').slice(0, 10),
    }));
  // The loader only returns leave whose return is after today, so starting on/before today = out now.
  const outNow = rows.filter(r => r.leave_on <= today);
  const later = rows.filter(r => r.leave_on > today);

  // Group the later ones by the month they start in (rows arrive sorted by leave_on).
  const groups: { month: string; label: string; rows: UpcomingRow[] }[] = [];
  for (const r of later) {
    const month = r.leave_on.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.month !== month) {
      g = { month, label: MONTHS[Number(month.slice(5, 7)) - 1] ?? month, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }

  return (
    <section aria-labelledby="pto-coming-up" className="mx-6 mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-baseline gap-3 mb-3">
        <h2 id="pto-coming-up" className="text-[16px] leading-[22px] font-semibold text-primary">Coming Up 🌴</h2>
        {rows.length > 0 && (
          <span className="text-[13px] text-slate-500">
            {outNow.length} out now · {later.length} later this year
          </span>
        )}
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="shrink-0 w-56 h-[104px] rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-[12px] text-red-600">Couldn&apos;t load upcoming time off — loadPtoUpcoming</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No One Is Out for the Rest of the Year" compact />
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-1">
          {outNow.length > 0 && (
            <div className="flex flex-col gap-2 shrink-0">
              <GroupHeading label="Out Now" warm />
              <div className="flex gap-2">
                {outNow.map(r => (
                  <LeaveCard key={r.src_id} r={r} out thisYear={thisYear} />
                ))}
              </div>
            </div>
          )}
          {outNow.length > 0 && groups.length > 0 && <div className="w-px bg-slate-200 shrink-0" />}
          {groups.map(g => (
            <div key={g.month} className="flex flex-col gap-2 shrink-0">
              <GroupHeading label={g.label} count={g.rows.length} />
              <div className="flex gap-2">
                {g.rows.map(r => (
                  <LeaveCard key={r.src_id} r={r} out={false} thisYear={thisYear} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

## `src/app/lib/fmtDay.ts` (whole file)

```ts
// Weekday-first date display for the PTO tracker: "Mon Aug 17", with the year
// appended only when it is not the current one. Everything here is integer
// arithmetic on YYYY-MM-DD strings — no Date object is ever constructed, so
// the timezone invariant in AGENTS.md holds by construction.

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(v: string | null | undefined): [number, number, number] | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Days since 1970-01-01 for a civil date (Howard Hinnant's days_from_civil). */
function dayNumber(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** 0 = Sunday … 6 = Saturday. -1 when the input is not a date. */
export function weekday(ymd: string | null | undefined): number {
  const p = parts(ymd);
  if (!p) return -1;
  return (((dayNumber(p[0], p[1], p[2]) + 4) % 7) + 7) % 7;
}

/** "Mon Aug 17", or "Mon Aug 17, 2027" when the year differs from thisYear. */
export function fmtDay(ymd: string | null | undefined, thisYear?: string): string {
  if (!ymd) return '';
  const p = parts(ymd);
  if (!p) return String(ymd);
  const base = `${WD[weekday(ymd)]} ${MON[p[1] - 1]} ${p[2]}`;
  return String(p[0]) === thisYear ? base : `${base}, ${p[0]}`;
}

/** "Mon Aug 17 → Fri Aug 21"; collapses to one day when the end is missing or equal. */
export function fmtRange(a: string | null | undefined, b: string | null | undefined, thisYear?: string): string {
  const s = fmtDay(a, thisYear);
  const e = fmtDay(b, thisYear);
  if (!e || e === s) return s;
  return `${s} → ${e}`;
}

const WD_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/** "Thursday, September 8, 2026". Accepts a YYYY-MM-DD string or a Postgres timestamp string. */
export function fmtDayLong(ymd: string | null | undefined): string {
  if (!ymd) return '';
  const p = parts(ymd);
  if (!p) return String(ymd);
  return `${WD_LONG[weekday(ymd)]}, ${MON_LONG[p[1] - 1]} ${p[2]}, ${p[0]}`;
}

/** Mon–Fri days in [leaveOn, returnOn). What a floating holiday spends; PTO uses calendar days instead. */
export function weekdayCount(leaveOn: string, returnOn: string): number {
  const a = parts(leaveOn);
  const b = parts(returnOn);
  if (!a || !b) return 0;
  const start = dayNumber(a[0], a[1], a[2]);
  const end = dayNumber(b[0], b[1], b[2]);
  let n = 0;
  for (let k = start; k < end; k++) {
    const wd = (((k + 4) % 7) + 7) % 7;
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}

/** Inverse of dayNumber (Howard Hinnant's civil_from_days): day count → "YYYY-MM-DD". */
function fromDayNumber(z: number): string {
  const zz = z + 719468;
  const era = Math.floor(zz / 146097);
  const doe = zz - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The calendar day before a YYYY-MM-DD date ('' when the input is not a date). */
export function dayBefore(ymd: string | null | undefined): string {
  const p = parts(ymd);
  if (!p) return '';
  return fromDayNumber(dayNumber(p[0], p[1], p[2]) - 1);
}

/**
 * The days someone is actually out: first day off → the day before they return.
 * "Mon Aug 17 → Sun Aug 23"; one date when it is a single day or the return is missing/invalid.
 */
export function fmtLeaveDates(leaveOn: string | null | undefined, returnOn: string | null | undefined, thisYear?: string): string {
  const a = String(leaveOn ?? '').slice(0, 10);
  const b = String(returnOn ?? '').slice(0, 10);
  if (!a) return '';
  if (!b || b <= a) return fmtDay(a, thisYear);
  return fmtRange(a, dayBefore(b), thisYear);
}
```

## `src/app/SectionBar.tsx` (whole file)

```tsx
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLoadAction } from '@uibakery/data';
import { cn } from '@/lib/utils';
import loadUnresolvedCountAction from '@/actions/loadUnresolvedCount';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import FilterBar from '@/app/FilterBar';
import { getConfig } from '@/app/lib/filterRoutes';
import { SECTIONS, getActiveSection, BADGE } from '@/app/TopNav';

// Navigation option A, row 2 (Saul, 2026-10-06): the active section's name and its
// pages as tabs on the left, that page's filters on the right (FilterBar, compact).
// On a narrow window the filters wrap onto a second line under the tabs instead of
// being cut off; the tabs always keep the first line.
export default function SectionBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { arVersion } = useGlobalFilters();

  const [unresolvedData, , , reloadUnresolved] = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);
  const unresolvedCount = (unresolvedData as { count: number }[])[0]?.count ?? 0;

  // Reload the Action Required tab badge whenever entries are committed or reverted
  const arVersionRef = useRef(arVersion);
  useEffect(() => {
    if (arVersionRef.current !== arVersion) {
      arVersionRef.current = arVersion;
      reloadUnresolved();
    }
  }, [arVersion, reloadUnresolved]);

  const activeId = getActiveSection(location.pathname);
  const sec = SECTIONS.find(s => s.id === activeId) ?? null;
  // Nothing to show (e.g. '/' while it redirects): no empty white strip.
  if (!sec && !getConfig(location.pathname)) return null;

  return (
    <div className="shrink-0 bg-white border-b border-slate-200 px-5 min-h-[48px] flex flex-wrap items-center gap-x-3 z-30">
      {sec && (
        <div className="flex items-center gap-2 h-12 min-w-0 max-w-full">
          <span
            className="flex items-center gap-2 pr-3 border-r border-slate-200 text-[13px] font-bold whitespace-nowrap shrink-0"
            style={{ color: sec.color.ink }}
          >
            <span className="w-2 h-2 rounded-sm" style={{ background: sec.color.accent }} aria-hidden="true" />
            {sec.label}
          </span>
          {sec.links.length > 0 && (
            <nav aria-label={`${sec.label} pages`} className="flex h-12 min-w-0 overflow-x-auto no-scrollbar">
              {sec.links.map(l => {
                const isActive =
                  location.pathname === l.to ||
                  (l.to !== '/' && location.pathname.startsWith(l.to + '/'));
                return (
                  <button
                    key={l.to}
                    onClick={() => navigate(l.to)}
                    aria-current={isActive ? 'page' : undefined}
                    style={isActive ? { borderBottomColor: sec.color.accent } : undefined}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 h-12 border-b-2 text-[13px] whitespace-nowrap shrink-0 transition-colors duration-100 focus:outline-none',
                      isActive
                        ? 'font-semibold text-slate-900'
                        : 'border-transparent font-medium text-slate-500 hover:text-slate-900'
                    )}
                  >
                    <l.icon className="w-3.5 h-3.5 opacity-70 shrink-0" />
                    <span>{l.label}</span>
                    {'badge' in l && l.badge && unresolvedCount > 0 && (
                      <span className={BADGE}>
                        {unresolvedCount > 99 ? '99+' : unresolvedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      )}
      <div className="flex-1" />
      <FilterBar />
    </div>
  );
}
```

## Report
- Byte size of the four files; confirm no other file changed; PTO Tracker shows Coming Up and
  typing a name in Employee narrows both the strip and the table; no console errors.
