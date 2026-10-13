import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTIONS, getActiveSection } from '@/app/TopNav';
import { useViewer } from '@/app/context/ViewerContext';
import { mobileNavItems, navBadge } from '@/app/lib/mobileNav';
import type { NavBadges } from '@/app/lib/useNavBadges';
import MobileSheet from '@/app/components/mobile/MobileSheet';

// Short names for the bar. A section that is not listed keeps its own label.
const SHORT_LABEL: Record<string, string> = { pto: 'PTO' };

// One button of the bar: at least 44 x 44 px to the finger, 12px text.
const ITEM = 'flex-1 min-w-11 min-h-11 flex flex-col items-center justify-center gap-1 border-t-[3px] text-[12px] leading-none select-none';
// The top bar's orange badge with navy ink, at the phone's 12px minimum.
const COUNT = 'absolute -top-1.5 left-3 bg-warm text-warm-ink text-[12px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center leading-none';

/** The phone's section bar: the last row of the frame, under the page. Rendered by Shell (app.tsx) on a phone only. */
export default function BottomNav({ badges }: { badges: NavBadges }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSuper } = useViewer();
  const [moreOpen, setMoreOpen] = useState(false);

  // SECTIONS order is the computer's order; filtering it keeps that order.
  const items = mobileNavItems(isSuper);
  const bar = SECTIONS.filter(s => items.bar.includes(s.id));
  const more = SECTIONS.filter(s => items.more.includes(s.id));
  const active = getActiveSection(location.pathname);
  const moreActive = more.some(s => s.id === active);

  return (
    <>
      <nav aria-label="Sections" className="shrink-0 h-14 flex items-stretch bg-white border-t border-slate-200 z-30">
        {bar.map(s => {
          const isActive = active === s.id;
          const b = navBadge(s.id, badges, isSuper);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => navigate(s.home)}
              aria-current={isActive ? 'page' : undefined}
              style={{ color: s.color.ink, borderTopColor: isActive ? s.color.accent : 'transparent' }}
              className={cn(ITEM, isActive ? 'font-bold bg-slate-50' : 'font-medium')}
            >
              <span className="relative flex">
                <s.icon className="w-5 h-5" aria-hidden="true" />
                {b && (
                  <span className={COUNT} aria-label={b.label}>
                    {b.count > 99 ? '99+' : b.count}
                  </span>
                )}
              </span>
              <span>{SHORT_LABEL[s.id] ?? s.label}</span>
            </button>
          );
        })}
        {more.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              ITEM, 'text-slate-600',
              moreActive ? 'font-bold bg-slate-50 border-slate-500' : 'font-medium border-transparent',
            )}
          >
            <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            <span>More</span>
          </button>
        )}
      </nav>

      <MobileSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        {more.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setMoreOpen(false); navigate(s.home); }}
            aria-current={active === s.id ? 'page' : undefined}
            className="w-full min-h-14 px-4 py-2 flex items-center gap-3 text-left border-b border-border last:border-b-0 active:bg-slate-50"
          >
            <s.icon className="w-5 h-5 shrink-0" style={{ color: s.color.ink }} aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold" style={{ color: s.color.ink }}>{s.label}</span>
              <span className="block text-[12px] text-muted-foreground">Best on a computer</span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
          </button>
        ))}
      </MobileSheet>
    </>
  );
}
