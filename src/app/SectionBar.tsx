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
