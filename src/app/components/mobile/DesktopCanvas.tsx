import type { ReactNode } from 'react';
import { useIsPhone } from '@/app/lib/useIsPhone';

// Payroll and Admin are not redesigned for a phone. On a phone this lays the page out in a box at
// least 1024 px wide, exactly as on a computer, and the scroll area around it (<main>, or
// AdminLayout's own) lets the person slide to the rest. h-full keeps the height chain the pages
// rely on for their inner scroll areas.
//
// The desktop-canvas class is on the div at EVERY size and has no styles of its own: index.css
// uses it to leave Payroll and Admin out of its touch-screen rules, on tablets as well as phones.
//
// The div is ALWAYS rendered, never swapped for bare children: Process Payroll keeps an unsaved
// run in page state, and a wrapper that appears and disappears when the screen size flips would
// remount the page and lose it. On a computer the div is display: contents, which makes no box,
// so the page lays out against <main> (or AdminLayout's div) exactly as before.
export default function DesktopCanvas({ children }: { children: ReactNode }) {
  const isPhone = useIsPhone();
  return <div className={isPhone ? 'desktop-canvas h-full min-w-[1024px]' : 'desktop-canvas contents'}>{children}</div>;
}
