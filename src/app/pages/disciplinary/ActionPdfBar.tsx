// Download buttons and edit history for one disciplinary action. Everyone who
// can see the action can download its PDF. The stored PDF is fetched on click
// (loadDisciplinaryPdf, about 250 KB); when none is stored (older rows, or a
// deleted row), the PDF is rebuilt from the row with buildDisciplinaryPdfBase64.
import { useState } from 'react';
import type { ReactNode } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import { fmtDate } from '@/app/lib/fmtDate';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import loadDisciplinaryPdfAction from '@/actions/loadDisciplinaryPdf';
import { buildDisciplinaryPdfBase64 } from '@/app/lib/disciplinaryPdf/render';
import { pdfFilename } from '@/app/lib/disciplinaryPdf/strings';
import { downloadBase64Pdf } from './downloadPdf';

interface Props {
  action: DisciplinaryRow;
  children?: ReactNode;   // extra buttons on the right (Edit)
}

type StoredPdf = { pdf_en_base64: string | null; pdf_en_original_base64: string | null };

export default function ActionPdfBar({ action, children }: Props) {
  const [fetchPdf] = useMutateAction(loadDisciplinaryPdfAction);
  const [busy, setBusy] = useState<'current' | 'original' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(which: 'current' | 'original') {
    setBusy(which);
    setError(null);
    try {
      const res = await fetchPdf({ id: action.id });
      const stored = (Array.isArray(res) ? res[0] : null) as StoredPdf | null;
      if (which === 'original') {
        const original = stored?.pdf_en_original_base64 ?? '';
        if (!original) {
          setError('The original PDF could not be found.');
          return;
        }
        downloadBase64Pdf(original, pdfFilename(action.ref).replace(/\.pdf$/, '_ORIGINAL.pdf'));
        return;
      }
      const current = stored?.pdf_en_base64 || buildDisciplinaryPdfBase64(action);
      downloadBase64Pdf(current, pdfFilename(action.ref));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const edited = action.edited_at
    ? `Edited by ${action.edited_by ?? 'unknown'} on ${fmtDate(action.edited_at.slice(0, 10))}`
    : null;

  return (
    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => download('current')}
          disabled={busy !== null}
          className="h-8 text-[12px]"
        >
          {busy === 'current'
            ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            : <FileDown className="w-3.5 h-3.5 mr-1" />}
          Download PDF
        </Button>
        {action.has_original && !action.deleted_at && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => download('original')}
            disabled={busy !== null}
            className="h-8 text-[12px]"
          >
            {busy === 'original'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <FileDown className="w-3.5 h-3.5 mr-1" />}
            Download original PDF
          </Button>
        )}
        {edited && <span className="text-[11px] text-slate-500">{edited}</span>}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
