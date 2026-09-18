import { useEffect } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import { useTeramindPull } from '@/app/pages/admin/teramind/useTeramindPull';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';
import loadTeramindPullLogAction from '@/actions/loadTeramindPullLog';
import { keepFreshRange } from '@/app/lib/teramindPull';
import { easternDate } from '@/app/lib/teramindTime';

// Module-level guards — survive across re-renders; reset on full page reload.
let inFlight = false;
let lastFailureMs = 0;

/**
 * Silently keeps today's Teramind Time Records copy fresh while a super user has the Hub open.
 * Renders nothing. Fires only for super users; managers are never involved.
 */
export default function TeramindAutoSync() {
  const { isSuper } = useViewer();
  const { pullRange } = useTeramindPull();

  const [fetchConfig]  = useMutateAction(loadClassificationConfigAction);
  const [fetchPullLog] = useMutateAction(loadTeramindPullLogAction);

  useEffect(() => {
    if (!isSuper) return;

    async function maybeSync() {
      // Skip when the tab is hidden
      if (document.hidden) return;
      // Skip when another copy is already running
      if (inFlight) return;

      // Read interval from config (default 15, minimum 5)
      let intervalMinutes = 15;
      try {
        const cfgResp = await fetchConfig({});
        const rows = Array.isArray(cfgResp) ? (cfgResp as { key: string; value: string }[]) : [];
        const row = rows.find(r => r.key === 'sync_every_minutes') ?? rows.find(r => r.key === 'teramind_sync_every_minutes');
        if (row) {
          const parsed = parseInt(row.value, 10);
          if (!isNaN(parsed) && parsed >= 5) intervalMinutes = parsed;
        }
      } catch {
        // use default
      }

      const intervalMs = intervalMinutes * 60 * 1000;

      // Don't retry within the interval after a failure
      if (lastFailureMs > 0 && Date.now() - lastFailureMs < intervalMs) return;

      // Read the pull log to find the newest 'auto' pull with no error
      let lastAutoMs = 0;
      try {
        const logResp = await fetchPullLog({});
        const logRows = Array.isArray(logResp) ? (logResp as Record<string, unknown>[]) : [];
        for (const row of logRows) {
          if (row.trigger !== 'auto') continue;
          if (row.error) continue;
          const ts = row.pulled_at ? new Date(String(row.pulled_at)).getTime() : 0;
          if (ts > lastAutoMs) lastAutoMs = ts;
        }
      } catch {
        // proceed — treat as no prior auto pull
      }

      // Enough time has passed?
      if (lastAutoMs > 0 && Date.now() - lastAutoMs < intervalMs) return;

      // Pull
      inFlight = true;
      try {
        const range = keepFreshRange(easternDate(Date.now()));
        await pullRange(range.from, range.to, 'auto');
      } catch (e) {
        lastFailureMs = Date.now();
        console.warn('Teramind keep-fresh sync failed:', e);
      } finally {
        inFlight = false;
      }
    }

    // Check on mount and then every 60 seconds
    const first = setTimeout(maybeSync, 20_000);
    const timer = setInterval(maybeSync, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);

  return null;
}
