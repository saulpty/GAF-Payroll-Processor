import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, AlertCircle, ArrowUpRight } from 'lucide-react';
import { PdfSubmissionData, generateDisciplinaryPdfENBase64 } from '@/app/utils/generatePdf';
import { DisciplinaryFormData } from '@/app/utils/disciplinaryFormData';

const GAF_RED = '#E52020';
const GAF_NAVY = '#1C2340';

export interface PriorAction {
  id: number;
  ref: string;
  document_date: string;
  warning_level: string;
  final_outcome: string | null;
  scenario: string;
  q_expected: string;
  q_happened: string;
  q_when: string;
  q_impact: string;
  expectations: string;
  consequences: string;
  evidence_types: string[] | null;
  evidence_description: string;
  prior_warnings: string;
  manager_name: string | null;
  manager_email: string | null;
  pdf_en_base64: string | null;
  pdf_es_base64: string | null;
  submitted_at: string;
}

interface Props {
  actions: PriorAction[];
  employeeName: string;
  onFollowUp: (action: PriorAction) => void;
  activeFollowUpId: number | null;
}

function truncate(text: string, max = 90): string {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function downloadBase64Pdf(base64: string, filename: string) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function levelColor(level: string): string {
  if (level?.includes('Final')) return '#991B1B';
  if (level?.includes('Second')) return '#C2410C';
  if (level?.includes('First')) return '#B45309';
  return '#6B7280';
}

interface CardProps {
  action: PriorAction;
  employeeName: string;
  onFollowUp: (action: PriorAction) => void;
  isActive: boolean;
}

function ActionCard({ action: row, employeeName, onFollowUp, isActive }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (row.pdf_en_base64) {
        downloadBase64Pdf(row.pdf_en_base64, `GAF_Disciplinary_Action_EN_${row.ref}.pdf`);
      } else {
        const fakeData: PdfSubmissionData = {
          ref: row.ref,
          managerName: '',
          managerEmail: '',
          documentDate: row.document_date,
          employeeName,
          employeeRole: '',
          employeeBranch: '',
          warningLevel: row.warning_level as DisciplinaryFormData['warningLevel'],
          finalOutcome: (row.final_outcome ?? '') as DisciplinaryFormData['finalOutcome'],
          scenario: row.scenario as DisciplinaryFormData['scenario'],
          qExpected: row.q_expected ?? '',
          qHappened: row.q_happened ?? '',
          qWhen: row.q_when ?? '',
          qImpact: row.q_impact ?? '',
          evidenceTypes: [],
          evidenceDescription: row.evidence_description ?? '',
          priorWarnings: row.prior_warnings ?? '',
          expectations: row.expectations ?? '',
          consequences: row.consequences ?? '',
          revaluationDate: '',
          signatureDrawn: false,
        };
        const base64 = await generateDisciplinaryPdfENBase64(fakeData);
        downloadBase64Pdf(base64, `GAF_Disciplinary_Action_EN_${row.ref}.pdf`);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
    setDownloading(false);
  };

  const dateDisplay = row.document_date
    ? new Date(row.document_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '—';

  return (
    <div
      className="border-2 rounded-xl overflow-hidden transition-colors"
      style={{ borderColor: isActive ? GAF_RED : '#E5E7EB' }}
    >
      {/* Card header */}
      <div
        className="flex items-start gap-3 p-3 transition-colors"
        style={{ backgroundColor: isActive ? '#FEF2F2' : '#ffffff' }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold" style={{ color: GAF_NAVY }}>{dateDisplay}</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: levelColor(row.warning_level) }}
            >
              {row.warning_level}
            </span>
            {row.final_outcome && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-700 text-white">
                {row.final_outcome}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{row.scenario}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1 leading-snug">{truncate(row.q_happened)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Follow-up button */}
          <button
            type="button"
            onClick={() => onFollowUp(row)}
            title={isActive ? 'Currently following up on this action' : 'Follow up to this action'}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors hover:opacity-80"
            style={
              isActive
                ? { backgroundColor: GAF_RED, color: '#ffffff', border: `1px solid ${GAF_RED}` }
                : { backgroundColor: '#FEF2F2', color: GAF_RED, border: `1px solid #FECACA` }
            }
          >
            <ArrowUpRight size={11} />
            {isActive ? 'Following up' : 'Follow up'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            title="Download EN PDF"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2 text-xs text-gray-700">
          {row.q_expected && <div><p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Expected behavior</p><p>{row.q_expected}</p></div>}
          {row.q_happened && <div><p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">What happened</p><p>{row.q_happened}</p></div>}
          {row.q_when && <div><p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">When</p><p>{row.q_when}</p></div>}
          {row.q_impact && <div><p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Impact</p><p>{row.q_impact}</p></div>}
          {row.expectations && <div><p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Expectations set</p><p>{row.expectations}</p></div>}
          {row.consequences && <div><p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Consequences</p><p>{row.consequences}</p></div>}
          {row.ref && <p className="text-[10px] text-gray-400 mt-1">Ref: {row.ref}</p>}
        </div>
      )}
    </div>
  );
}

export default function PriorActionsPanel({ actions, employeeName, onFollowUp, activeFollowUpId }: Props) {
  if (actions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200">
        <AlertCircle size={13} className="shrink-0" />
        No prior disciplinary actions on file for <span className="font-semibold ml-1">{employeeName}</span>.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: GAF_RED }}>
          Prior Disciplinary Actions
        </span>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: GAF_RED }}
        >
          {actions.length}
        </span>
      </div>
      <div className="space-y-2">
        {actions.map(a => (
          <ActionCard
            key={a.id}
            action={a}
            employeeName={employeeName}
            onFollowUp={onFollowUp}
            isActive={a.id === activeFollowUpId}
          />
        ))}
      </div>
    </div>
  );
}
