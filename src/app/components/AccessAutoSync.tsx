import { useEffect } from 'react';
import { useMutateAction } from '@uibakery/data';
import { useAccessSync } from '@/app/pages/admin/access/useAccessSync';
import loadClassificationConfigAction from '@/actions/loadClassificationConfig';

type ConfigRow = { key: string; value: string };

// Module-level last-run timestamp — survives re-renders, reset on page reload.
let lastRunMs = 0;

/** Keeps access groups in step with the Monday directory.
 *  Runs on mount and then every 60 s; skips when already ran within sync_every_minutes. Renders nothing. */
export default function AccessAutoSync() {
  const sync = useAccessSync();
  const [fetchConfig] = useMutateAction(loadClassificationConfigAction);

  useEffect(() => {
    async function maybeSync() {
      if (document.hidden) return;

      let intervalMinutes = 15;
      try {
        const cfgResp = await fetchConfig({});
        const rows = Array.isArray(cfgResp) ? (cfgResp as ConfigRow[]) : [];
        const row = rows.find(r => r.key === 'sync_every_minutes') ?? rows.find(r => r.key === 'teramind_sync_every_minutes');
        if (row) {
          const parsed = parseInt(row.value, 10);
          if (!isNaN(parsed) && parsed >= 5) intervalMinutes = parsed;
        }
      } catch { /* use default */ }

      const intervalMs = intervalMinutes * 60 * 1000;
      if (lastRunMs > 0 && Date.now() - lastRunMs < intervalMs) return;

      try {
        await sync(false);
        lastRunMs = Date.now();
      } catch (e) {
        console.warn('Access groups sync from Monday failed:', e);
      }
    }

    maybeSync();
    const timer = setInterval(maybeSync, 60_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
