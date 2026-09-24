// What the editor sees after a successful save: the email outcome, the new PDF
// to download, and Done (which closes the editor and reloads the list). An
// email failure keeps the save and offers Retry email.
import { CheckCircle2, AlertTriangle, FileDown, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SaveResult } from './useSaveDisciplinaryEdit';
import { downloadBase64Pdf } from './downloadPdf';

interface Props {
  result: SaveResult;
  sending: boolean;
  onRetry: () => void;
  onDone: () => void;
}

export default function EditResultPanel({ result, sending, onRetry, onDone }: Props) {
  const ok = result.email === 'sent';
  const text = ok
    ? `Saved \u2014 updated PDF emailed to ${result.managerName}`
    : result.email === 'no-address'
      ? 'Saved. No manager email is on file for this warning, so nothing was emailed. Download the PDF below.'
      : `Saved, but the email to ${result.managerName} failed: ${result.emailError ?? 'unknown error'}`;

  return (
    <div className={`mx-4 my-4 rounded-lg border px-4 py-3 ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className={`flex items-start gap-2 text-[13px] ${ok ? 'text-emerald-800' : 'text-amber-800'}`}>
        {ok
          ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
        <span>{text}</span>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[12px]"
          onClick={() => downloadBase64Pdf(result.pdf, result.filename)}
        >
          <FileDown className="w-3.5 h-3.5 mr-1" />Download updated PDF
        </Button>
        {result.email === 'failed' && (
          <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={onRetry} disabled={sending}>
            {sending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
            Retry email
          </Button>
        )}
        <Button size="sm" className="h-8 text-[12px]" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
