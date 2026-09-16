import { useEffect } from 'react';
import { useAccessSync } from '@/app/pages/admin/access/useAccessSync';

/** Keeps access groups in step with the Monday directory. Runs once per app open, at most every 30 minutes. Renders nothing. */
export default function AccessAutoSync() {
  const sync = useAccessSync();
  useEffect(() => {
    sync(false).catch(e => console.warn('Access groups sync from Monday failed:', e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
