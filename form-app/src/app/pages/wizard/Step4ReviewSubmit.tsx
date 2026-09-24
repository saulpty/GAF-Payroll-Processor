import React, { useCallback, useState } from 'react';
import { ClipboardList, PenLine } from 'lucide-react';
import { Label } from '@/components/ui/label';
import SignaturePad from '@/app/components/SignaturePad';
import { DisciplinaryFormData } from '@/app/utils/disciplinaryFormData';

const GAF_RED = '#E52020';

interface SummaryRowProps {
  label: string;
  value: string | string[] | boolean | null | undefined;
}

function SummaryRow({ label, value }: SummaryRowProps) {
  const display = Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || '—';
  return (
    <div className="grid grid-cols-5 gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className="col-span-2 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="col-span-3 text-sm text-gray-900">{display}</span>
    </div>
  );
}

interface Props {
  data: DisciplinaryFormData;
  onChange: (updates: Partial<DisciplinaryFormData>) => void;
  signatureError?: string;
}

export default function Step4ReviewSubmit({ data, onChange, signatureError }: Props) {
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const handleSignatureChange = useCallback((dataUrl: string | null) => {
    setSignatureDataUrl(dataUrl);
    onChange({ signatureDrawn: !!dataUrl });
  }, [onChange]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <ClipboardList size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Form Summary — Please review carefully</span>
        </div>
      <div className="rounded-lg border bg-gray-50 p-4 space-y-0">
        <SummaryRow label="Manager" value={data.managerName} />
        <SummaryRow label="Manager Email" value={data.managerEmail} />
        <SummaryRow label="Document Date" value={data.documentDate} />
        <SummaryRow label="Employee" value={data.employeeName} />
        <SummaryRow label="Job Title" value={data.employeeRole} />
        <SummaryRow label="Branch" value={data.employeeBranch} />
        <SummaryRow label="Warning Level" value={data.warningLevel} />
        {data.finalOutcome && <SummaryRow label="Final Outcome" value={data.finalOutcome} />}
        <SummaryRow label="Scenario" value={data.scenario} />
        <SummaryRow label="Expected Behavior" value={data.qExpected} />
        <SummaryRow label="What Happened" value={data.qHappened} />
        <SummaryRow label="When" value={data.qWhen} />
        <SummaryRow label="Impact" value={data.qImpact} />
        <SummaryRow label="Evidence Types" value={data.evidenceTypes} />
        <SummaryRow label="Evidence Description" value={data.evidenceDescription} />
        <SummaryRow label="Prior Warnings" value={data.priorWarnings} />
        <SummaryRow label="Expectations" value={data.expectations} />
        <SummaryRow label="Consequences" value={data.consequences} />
        <SummaryRow label="Re-evaluation Date" value={data.revaluationDate} />
      </div>
      </div>

      {/* Signature */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <PenLine size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Signature</span>
        </div>
        <Label className="sr-only">
          Employee / Manager Signature <span style={{ color: GAF_RED }}>*</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          By signing below you confirm the contents of this disciplinary action are accurate.
        </p>
        <SignaturePad onChange={handleSignatureChange} error={signatureError} />
        {signatureDataUrl && (
          <p className="text-xs text-green-600 font-medium">✓ Signature captured</p>
        )}
      </div>
    </div>
  );
}
