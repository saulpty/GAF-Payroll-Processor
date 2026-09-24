import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const GAF_RED = '#E52020';
const GAF_NAVY = '#1C2340';

export default function SuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const ref: string | undefined = (location.state as { ref?: string })?.ref;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F6FA' }}>
      {/* Navy header bar */}
      <div className="w-full py-3 px-6 flex items-center" style={{ backgroundColor: GAF_NAVY }}>
        <div className="flex items-center gap-3">
          <img
            src="https://gafhealthcare.com/assets/images-webp/GAFLogos/2.webp"
            alt="GAF Healthcare"
            className="h-9 w-auto object-contain"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <p className="text-[10px] font-semibold tracking-[0.2em] text-white uppercase leading-tight">GAF HEALTHCARE SERVICES PANAMA</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-md w-full space-y-4">
          <Card className="shadow-md border-0">
            <CardContent className="p-8 text-center space-y-5">
              <div className="flex justify-center">
                <div className="rounded-full p-3" style={{ backgroundColor: '#E5202018' }}>
                  <CheckCircle className="h-12 w-12" style={{ color: GAF_RED }} />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-extrabold font-heading" style={{ color: GAF_NAVY }}>
                  Form Submitted Successfully
                </h1>
                <p className="text-sm text-muted-foreground mt-1 font-sans">
                  The disciplinary action form has been recorded and emails have been sent.
                </p>
              </div>

              {ref && (
                <div className="rounded-xl p-4 space-y-1" style={{ backgroundColor: '#F5F6FA', border: '1px solid #E5E7EB' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reference Number</p>
                  <p className="text-lg font-extrabold font-mono" style={{ color: GAF_RED }}>{ref}</p>
                </div>
              )}

              <div className="pt-1">
                <Button
                  onClick={() => navigate('/')}
                  className="w-full gap-2 text-white font-bold rounded-2xl transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg"
                  style={{ backgroundColor: GAF_RED, borderColor: GAF_RED }}
                >
                  <RefreshCw className="h-4 w-4" />
                  Submit Another Form
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
