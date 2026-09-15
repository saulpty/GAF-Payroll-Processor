import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useViewer, reloadApp } from '@/app/context/ViewerContext';
import type { ReactNode } from 'react';

export default function AccessGate({ children }: { children: ReactNode }) {
  const { status, realEmail, viewAs, isViewingAs, setViewAs } = useViewer();

  if (status === 'ready') return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full flex flex-col items-center gap-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            <p className="text-slate-500 text-sm">Checking access…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <ShieldX className="w-8 h-8 text-red-400" />
            <p className="text-slate-700 text-sm">Couldn't check your access.</p>
            <Button variant="outline" size="sm" onClick={reloadApp}>Retry</Button>
          </>
        )}

        {status === 'blocked' && (
          <>
            <ShieldX className="w-8 h-8 text-red-400" />
            <h2 className="text-lg font-semibold text-slate-800">No access</h2>
            <p className="text-slate-500 text-sm">
              Your account ({realEmail}) is not on the GAF Panama HR Hub access list.
              Contact Saul at saul.f@vitasyahc.com to be added.
            </p>
            {isViewingAs && (
              <>
                <p className="text-slate-500 text-sm">
                  You are viewing as {viewAs}, who is not on the list or is inactive.
                </p>
                <Button variant="outline" size="sm" onClick={() => setViewAs('')}>
                  Stop viewing as
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
