'use client';

import { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';
import { useLoadAction } from '@uibakery/data';
import loadCurrentViewerAction from '@/actions/loadCurrentViewer';
import { viewerStatus, normalizeEmail } from '@/app/lib/access';
import type { ViewerRow } from '@/app/lib/access';

const VIEW_AS_KEY = 'gaf_view_as';

function readViewAs(): string {
  try { return normalizeEmail(window.sessionStorage.getItem(VIEW_AS_KEY)); } catch { return ''; }
}

export interface Viewer {
  status: 'loading' | 'error' | 'blocked' | 'ready';
  realEmail: string;
  email: string;
  name: string;
  isSuper: boolean;
  allEmployees: boolean;
  viewAs: string;
  isViewingAs: boolean;
  setViewAs: (email: string) => void;
  reload: () => void;
}

const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({ children }: { children: ReactNode }) {
  const [viewAs, setViewAsState] = useState<string>(readViewAs);

  const [rows, loading, error, reload] = useLoadAction(
    loadCurrentViewerAction,
    [] as ViewerRow[],
    { viewAs },
  );

  const setViewAs = useCallback((email: string) => {
    const v = normalizeEmail(email);
    try {
      if (v) window.sessionStorage.setItem(VIEW_AS_KEY, v);
      else window.sessionStorage.removeItem(VIEW_AS_KEY);
    } catch { /* storage unavailable */ }
    setViewAsState(v);
  }, []);

  const value = useMemo<Viewer>(() => {
    const row = (rows as ViewerRow[])[0] ?? null;
    const status: Viewer['status'] =
      loading ? 'loading' : error ? 'error' : viewerStatus(row);
    const realEmail = normalizeEmail(row?.real_email);
    const email = normalizeEmail(row?.email);
    return {
      status,
      realEmail,
      email,
      name: row?.display_name || email,
      isSuper: status === 'ready' && row?.role === 'super_user',
      allEmployees: status === 'ready' && (row?.role === 'super_user' || row?.all_employees === true),
      viewAs,
      isViewingAs: viewAs !== '' && viewAs !== realEmail,
      setViewAs,
      reload,
    };
  }, [rows, loading, error, viewAs, setViewAs, reload]);

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  const v = useContext(ViewerContext);
  if (!v) throw new Error('useViewer must be used inside ViewerProvider');
  return v;
}
