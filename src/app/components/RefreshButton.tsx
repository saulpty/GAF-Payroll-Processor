import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { runAllSyncs } from '@/app/lib/refreshBus';

// Module-level: one refresh at a time, even though the bar remounts when it finishes.
let running = false;

/** Top-bar Refresh: runs the background syncs now (super users only have any), then reloads the page's data. */
export default function RefreshButton() {
  const { bumpRefreshVersion } = useGlobalFilters();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [busy, setBusy] = useState(running);

  async function refresh() {
    if (running) return;
    running = true;
    setBusy(true);
    try {
      await runAllSyncs();
    } finally {
      running = false;
      setBusy(false);
    }
    // Process Payroll keeps an unsaved run in page state: never remount it.
    if (!pathRef.current.startsWith('/process')) bumpRefreshVersion();
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      title={busy ? 'Refreshing data…' : 'Refresh data now'}
      aria-label="Refresh data"
      className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-70 disabled:cursor-wait"
    >
      <RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} />
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
