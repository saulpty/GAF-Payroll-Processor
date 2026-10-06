# Top bar: GAF navy for the whole app (Warm design system)

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.
If your context is compacted mid-task, re-read this prompt before writing.**

Saul approved the Warm look for the top bar (2026-10-06): the whole bar is GAF navy
(`--topnav`, already defined in `src/index.css`), section names are light text, the active section
is white with an **orange underline** (`border-warm`), and badges are orange with navy ink
(`bg-warm text-warm-ink`, never white on orange). The per-section colour pills are removed.
Nothing about what the bar does changes: same sections, same links, same badges and counts, same
Viewing As button.

**Only these two files may change:**
- `src/app/TopNav.tsx`: whole file below.
- `src/index.css`: append one rule at the very end (below). Nothing else in it changes.

No other file may be touched (not `BrandLogo.tsx`, `FilterBar.tsx`, `app.tsx`, any page, any
action, or `src/components/ui/*`).

## `src/app/TopNav.tsx` (whole file)

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  PlayCircle, AlertTriangle, TableIcon,
  Settings, History, Activity,
  Users, Clock, CalendarDays, Globe2,
  SlidersHorizontal, FileSpreadsheet,
  Palmtree, FileSignature, ShieldAlert, FileText,
  Eye, X, KeyRound, UserCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadUnresolvedCountAction from '@/actions/loadUnresolvedCount';
import loadContractsExpiringCountAction from '@/actions/loadContractsExpiringCount';
import loadDisciplinaryDueCountAction from '@/actions/loadDisciplinaryDueCount';
import loadPtoReviewCountAction from '@/actions/loadPtoReviewCount';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import BrandLogo from '@/app/components/BrandLogo';
import { useViewer } from '@/app/context/ViewerContext';
import { canSeeSection, homeFor } from '@/app/lib/access';

// ── Section definitions ────────────────────────────────────────────────────────
// Warm design system (2026-10-06): one navy bar for every section; the active
// section is white with an orange underline instead of its own colour pill.

const SECTIONS = [
  {
    id: 'payroll',
    label: 'Payroll',
    icon: TableIcon,
    home: '/payroll-master',
    paths: ['/process', '/action-required', '/payroll-master', '/hrk-summary', '/period-log'],
    links: [
      { to: '/payroll-master',  label: 'Payroll Master',  icon: TableIcon },
      { to: '/process',         label: 'Process',         icon: PlayCircle },
      { to: '/action-required', label: 'Action Required', icon: AlertTriangle, badge: true },
      { to: '/hrk-summary',     label: 'HRK Summary',     icon: FileSpreadsheet },
      { to: '/period-log',      label: 'Period Log',       icon: History },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Activity,
    home: '/attendance/today',
    paths: ['/attendance'],
    links: [
      { to: '/attendance/today',    label: 'Today',    icon: Clock },
      { to: '/attendance/activity', label: 'Activity', icon: Activity },
      { to: '/attendance/list',     label: 'List',     icon: Users },
      { to: '/attendance/reports',  label: 'Reports',  icon: FileText },
    ],
  },
  {
    id: 'disciplinary',
    label: 'Disciplinary',
    icon: ShieldAlert,
    home: '/disciplinary',
    paths: ['/disciplinary'],
    links: [],
    badge: true,
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: FileSignature,
    home: '/contracts',
    paths: ['/contracts'],
    links: [],
    badge: true,
  },
  {
    id: 'pto',
    label: 'PTO Tracker',
    icon: Palmtree,
    home: '/pto',
    paths: ['/pto'],
    links: [],
    badge: true,
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Settings,
    home: '/admin/employees',
    paths: ['/admin'],
    links: [
      { to: '/admin/employees',      label: 'Employees',           icon: Users },
      { to: '/admin/access',         label: 'Access',              icon: KeyRound },
      { to: '/admin/schedules',      label: 'Schedules',           icon: Clock },
      { to: '/admin/holidays',       label: 'Holidays',            icon: CalendarDays },
      { to: '/admin/dst-calendar',   label: 'DST Calendar',        icon: Globe2 },
      { to: '/admin/lookups',        label: 'Rules & Config',      icon: SlidersHorizontal },

    ],
  },
] as const;

type SectionId = 'payroll' | 'attendance' | 'disciplinary' | 'contracts' | 'pto' | 'admin';

function getActiveSection(pathname: string): SectionId | null {
  for (const s of SECTIONS) {
    if (s.paths.some(p => pathname === p || pathname.startsWith(p + '/'))) return s.id;
  }
  return null;
}

// Orange badge with navy ink: white on orange fails contrast.
const BADGE = 'bg-warm text-warm-ink text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none';

// ── TopNav ─────────────────────────────────────────────────────────────────────

export default function TopNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { ptoVersion, arVersion } = useGlobalFilters();
  const { isSuper, isViewingAs, name, email, setViewAs, viewAs } = useViewer();
  const visibleSections = SECTIONS.filter(s => canSeeSection(isSuper, s.id));

  const [unresolvedData, , , reloadUnresolved]  = useLoadAction(loadUnresolvedCountAction, [] as { count: number }[]);
  const unresolvedCount   = (unresolvedData as { count: number }[])[0]?.count ?? 0;
  const [expiringData]    = useLoadAction(loadContractsExpiringCountAction, [] as { count: number }[], { viewAs });
  const expiringCount     = (expiringData as { count: number }[])[0]?.count ?? 0;
  const asOf              = toLocalYMD(new Date());
  const [dueData]         = useLoadAction(loadDisciplinaryDueCountAction, [] as { count: number }[], { asOf });
  const dueCount          = (dueData as { count: number }[])[0]?.count ?? 0;
  const [reviewData, , , reloadReview] = useLoadAction(loadPtoReviewCountAction, [] as { count: number }[], { today: asOf, manager: null, viewAs });
  const reviewCount       = (reviewData as { count: number }[])[0]?.count ?? 0;

  // Reload PTO review count whenever a PTO record is written anywhere in the app
  const ptoVersionRef = useRef(ptoVersion);
  useEffect(() => {
    if (ptoVersionRef.current !== ptoVersion) {
      ptoVersionRef.current = ptoVersion;
      reloadReview();
    }
  }, [ptoVersion, reloadReview]);

  // Reload AR nav badge whenever entries are committed or reverted
  const arVersionRef = useRef(arVersion);
  useEffect(() => {
    if (arVersionRef.current !== arVersion) {
      arVersionRef.current = arVersion;
      reloadUnresolved();
    }
  }, [arVersion, reloadUnresolved]);

  function sectionBadge(id: string): { count: number; label: string } | null {
    if (!isSuper && id === 'disciplinary') return null;
    if (id === 'contracts' && expiringCount > 0) {
      return {
        count: expiringCount,
        label: `${expiringCount} contract${expiringCount === 1 ? '' : 's'} ending within 30 days`,
      };
    }
    if (id === 'disciplinary' && dueCount > 0) {
      return {
        count: dueCount,
        label: `${dueCount} disciplinary re-evaluation${dueCount === 1 ? '' : 's'} due`,
      };
    }
    if (id === 'pto' && reviewCount > 0) {
      return {
        count: reviewCount,
        label: `${reviewCount} PTO request${reviewCount === 1 ? '' : 's'} ready to record`,
      };
    }
    return null;
  }

  const activeSection = getActiveSection(location.pathname);
  const activeSectionDef = SECTIONS.find(s => s.id === activeSection) ?? null;

  // Animate sub-links: track previous section to detect change
  const prevSection = useRef<SectionId | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (prevSection.current !== activeSection) {
      setAnimKey(k => k + 1);
      prevSection.current = activeSection;
    }
  }, [activeSection]);

  return (
    <header className="topnav-dark shrink-0 h-14 bg-[var(--topnav)] text-[var(--topnav-foreground)] shadow-sm flex items-center px-4 gap-0 z-40 overflow-hidden">
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 mr-4 cursor-pointer select-none shrink-0"
        onClick={() => navigate(homeFor(isSuper))}
      >
        <BrandLogo />
        <div className="leading-tight hidden sm:block">
          <div className="text-white font-bold text-[14px] tracking-tight">GAF Panama</div>
          <div className="text-slate-300 text-[10px] tracking-wide">HR Hub</div>
        </div>
      </div>

      <div className="w-px h-6 bg-white/20 mr-2 shrink-0" />

      {/* Section buttons */}
      <div className="flex items-center gap-1 shrink-0 h-14">
        {visibleSections.map(s => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => navigate(s.home)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 px-3 h-14 border-b-2 text-[13px] font-medium transition-colors duration-150 select-none focus:outline-none',
                isActive
                  ? 'border-warm text-white'
                  : 'border-transparent text-slate-300 hover:text-white'
              )}
            >
              <s.icon className="w-4 h-4" />
              <span>{s.label}</span>
              {(() => {
                const b = 'badge' in s && s.badge ? sectionBadge(s.id) : null;
                return b && (
                  <span className={BADGE} aria-label={b.label}>
                    {b.count > 99 ? '99+' : b.count}
                  </span>
                );
              })()}
            </button>
          );
        })}
      </div>

      {/* Divider between sections and sub-links */}
      {activeSectionDef && activeSectionDef.links.length > 0 && (
        <div className="w-px h-6 bg-white/20 mx-3 shrink-0" />
      )}

      {/* Sub-links – animated slide-in */}
      {activeSectionDef && activeSectionDef.links.length > 0 && (
        <nav
          key={animKey}
          className="flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar"
          style={{ animation: 'slideInLeft 220ms cubic-bezier(.22,.68,0,1.2) both' }}
        >
          {activeSectionDef.links.map(l => {
            const isLinkActive =
              location.pathname === l.to ||
              (l.to !== '/' && location.pathname.startsWith(l.to + '/'));
            return (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                aria-current={isLinkActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] transition-colors duration-100 whitespace-nowrap shrink-0',
                  isLinkActive
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                )}
              >
                <l.icon className="w-3.5 h-3.5 opacity-80 shrink-0" />
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
      {isViewingAs ? (
        <button
          onClick={() => setViewAs('')}
          title="Stop viewing as this person"
          className="ml-auto shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
        >
          <Eye className="w-3.5 h-3.5" />
          Viewing As {name || email}
          <X className="w-3.5 h-3.5" />
        </button>
      ) : (
        <div
          title={email}
          className="ml-auto shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-white/10 text-white border border-white/20"
        >
          <UserCircle className="w-3.5 h-3.5" />
          {name || email}
          <span className="text-slate-300">· {isSuper ? 'Super User' : 'Manager'}</span>
        </div>
      )}
    </header>
  );
}
```

## `src/index.css`: append at the very end of the file

```css

/* Navy top bar (2026-10-06): the global focus outline is navy (--primary), which
   disappears on the navy bar. Inside the bar it is white. More specific than the
   global rule above, so it wins between the two !important rules. */
.topnav-dark button:focus-visible,
.topnav-dark a[href]:focus-visible,
.topnav-dark [role="button"]:focus-visible {
  outline-color: #FFFFFF !important;
}
```

## Report
- Byte size of the two files; confirm no other file changed and that every page still shows the
  bar with no console errors.
