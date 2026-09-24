import React, { useState, useRef, useEffect } from 'react';
import { useLoadAction } from '@uibakery/data';
import { X, Calendar, Users, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DisciplinaryFormData,
  WARNING_LEVELS,
  WarnLevel,
} from '@/app/utils/disciplinaryFormData';
import { useFilerScope } from '@/app/hooks/useFilerScope';
import FilerBanner from '@/app/pages/wizard/FilerBanner';
import EmployeePicker from '@/app/pages/wizard/EmployeePicker';
import PriorActionsPanel, { PriorAction } from '@/app/components/PriorActionsPanel';
import getPriorActionsAction from '@/actions/getPriorActions';

const GAF_RED = '#E52020';

interface Props {
  data: DisciplinaryFormData;
  onChange: (updates: Partial<DisciplinaryFormData>) => void;
  errors: Record<string, string>;
  onPriorWarningsSuggestion: (text: string) => void;
  onFollowUp: (action: PriorAction) => void;
}

type Btn = HTMLButtonElement;

function hoverIn(e: React.MouseEvent<Btn>, active: boolean) {
  if (!active) {
    (e.currentTarget as Btn).style.transform = 'scale(1.02)';
    (e.currentTarget as Btn).style.boxShadow = '0 4px 10px rgba(0,0,0,0.08)';
    (e.currentTarget as Btn).style.borderColor = '#D1D5DB';
  }
}
function hoverOut(e: React.MouseEvent<Btn>, active: boolean) {
  if (!active) {
    (e.currentTarget as Btn).style.transform = 'scale(1)';
    (e.currentTarget as Btn).style.boxShadow = 'none';
    (e.currentTarget as Btn).style.borderColor = '#E5E7EB';
  }
}
function press(e: React.MouseEvent<Btn>) { (e.currentTarget as Btn).style.transform = 'scale(0.97)'; }
function release(e: React.MouseEvent<Btn>) { (e.currentTarget as Btn).style.transform = 'scale(1.02)'; }

function buildPriorWarningsSummary(rows: PriorAction[]): string {
  if (!rows.length) return 'No prior disciplinary actions on file.';
  return rows.map(r => {
    const date = r.document_date
      ? new Date(r.document_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : '—';
    const happened = r.q_happened ? r.q_happened.slice(0, 80) + (r.q_happened.length > 80 ? '…' : '') : '';
    return `${date} — ${r.warning_level}${r.scenario ? ` (${r.scenario})` : ''}${happened ? ': ' + happened : ''}`;
  }).join('\n');
}

export default function Step1EmployeeWarning({ data, onChange, errors, onPriorWarningsSuggestion, onFollowUp }: Props) {
  const filer = useFilerScope();

  const [priorActionsParams, setPriorActionsParams] = useState({ employeeName: data.employeeName });
  const [priorActionsRaw, priorActionsLoading, , reloadPriorActions] = useLoadAction(
    getPriorActionsAction,
    [],
    priorActionsParams,
    { enabled: false },
  );
  const priorActions: PriorAction[] = (priorActionsRaw as PriorAction[] | null) ?? [];

  const lastQueriedEmployee = useRef('');
  const [followUpBanner, setFollowUpBanner] = useState<PriorAction | null>(null);
  const [activeFollowUpId, setActiveFollowUpId] = useState<number | null>(null);

  const handleFollowUp = (action: PriorAction) => {
    setFollowUpBanner(action);
    setActiveFollowUpId(action.id);
    onFollowUp(action);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDismissBanner = () => {
    setFollowUpBanner(null);
    setActiveFollowUpId(null);
  };

  // The filer is the signed-in user. Fill the form's manager fields from the login —
  // never from typing. The PDF "Supervisor" line and the email use them.
  useEffect(() => {
    if (filer.status === 'loading' || !filer.email) return;
    if (data.managerName !== filer.filerName || data.managerEmail !== filer.email) {
      onChange({ managerName: filer.filerName, managerEmail: filer.email });
    }
  }, [filer.status, filer.filerName, filer.email, data.managerName, data.managerEmail]);

  // A chosen employee who is not in this filer's list is cleared.
  const allowedKey = filer.employees.join('|');
  useEffect(() => {
    if (filer.status === 'ready' && data.employeeName && !filer.employees.includes(data.employeeName)) {
      onChange({ employeeName: '', employeeRole: '', employeeBranch: '' });
    }
  }, [filer.status, allowedKey, data.employeeName]);

  useEffect(() => {
    if (data.employeeName && data.employeeName !== lastQueriedEmployee.current) {
      lastQueriedEmployee.current = data.employeeName;
      setPriorActionsParams({ employeeName: data.employeeName });
    }
  }, [data.employeeName]);

  useEffect(() => {
    if (priorActionsParams.employeeName) {
      reloadPriorActions().catch(console.error);
    }
  }, [priorActionsParams]);

  useEffect(() => {
    if (!priorActionsLoading && data.employeeName) {
      onPriorWarningsSuggestion(buildPriorWarningsSummary(priorActions));
    }
  }, [priorActionsLoading, priorActions]);

  const handleEmployeeChange = (name: string) => {
    onChange({
      employeeName: name,
      employeeRole: filer.employeePositionMap.get(name) ?? '',
      employeeBranch: filer.employeeBranchMap.get(name) ?? '',
    });
  };

  return (
    <div className="space-y-6">

      {filer.email && filer.status !== 'loading' && filer.status !== 'filerError' && (
        <FilerBanner name={filer.filerName} email={filer.email} isAdmin={filer.isAdmin} count={filer.employees.length} />
      )}

      {/* ── Document Date ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <Calendar size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Document Date</span>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="documentDate">Date <span style={{ color: GAF_RED }}>*</span></Label>
          <Input
            id="documentDate"
            type="date"
            value={data.documentDate}
            onChange={e => onChange({ documentDate: e.target.value })}
            className={`max-w-xs ${errors.documentDate ? 'border-red-500' : ''}`}
          />
          {errors.documentDate && <p className="text-xs text-red-500">{errors.documentDate}</p>}
        </div>
      </div>

      {/* ── Employee Section ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <Users size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Employee</span>
        </div>

        <EmployeePicker
          value={data.employeeName}
          employees={filer.employees}
          status={filer.status}
          error={errors.employeeName}
          onSelect={handleEmployeeChange}
        />

        {data.employeeName && (
          <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Job Title</p>
              <p className="text-sm font-medium">{data.employeeRole || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Branch</p>
              <p className="text-sm font-medium">{data.employeeBranch || '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Prior Disciplinary Actions panel */}
      {data.employeeName && (
        <div className="space-y-2">
          {priorActionsLoading ? (
            <div className="text-xs text-muted-foreground px-1">Loading prior actions…</div>
          ) : (
            <PriorActionsPanel
              actions={priorActions}
              employeeName={data.employeeName}
              onFollowUp={handleFollowUp}
              activeFollowUpId={activeFollowUpId}
            />
          )}
        </div>
      )}

      {/* Follow-up banner */}
      {followUpBanner && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: '#FEF2F2', border: `1.5px solid #FECACA` }}
        >
          <Info size={14} style={{ color: GAF_RED }} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs mb-0.5" style={{ color: GAF_RED }}>
              Following up on a {followUpBanner.warning_level} from{' '}
              {followUpBanner.document_date
                ? new Date(followUpBanner.document_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
                : followUpBanner.document_date}
            </p>
            <p className="text-xs text-gray-600 leading-snug">
              The previous details are pre-filled — set the new <strong>Warning Level</strong> and dates, update anything that changed, then submit.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismissBanner}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Warning Level ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <AlertTriangle size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Warning Level</span>
        </div>
        <div className="space-y-2">
          {errors.warningLevel && <p className="text-xs text-red-500">{errors.warningLevel}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WARNING_LEVELS.map(level => {
              const active = data.warningLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChange({ warningLevel: level as WarnLevel, finalOutcome: '' })}
                  className="rounded-lg border-2 px-4 py-3 text-sm font-medium text-left transition-all duration-150 ease-out select-none"
                  style={
                    active
                      ? { borderColor: GAF_RED, backgroundColor: '#FEF2F2', color: GAF_RED, transform: 'scale(1.02)', boxShadow: '0 4px 12px rgba(229,32,32,0.15)' }
                      : { borderColor: '#E5E7EB', backgroundColor: '#fff', color: '#374151' }
                  }
                  onMouseEnter={e => hoverIn(e, active)}
                  onMouseLeave={e => hoverOut(e, active)}
                  onMouseDown={press}
                  onMouseUp={release}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Final Outcome */}
      {data.warningLevel === 'Final Written Warning' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
            <ShieldAlert size={15} style={{ color: GAF_RED }} />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Final Outcome</span>
          </div>
          <div className="space-y-2">
            {errors.finalOutcome && <p className="text-xs text-red-500">{errors.finalOutcome}</p>}
            <div className="flex gap-3">
              {(['Suspension', 'Termination'] as const).map(outcome => {
                const active = data.finalOutcome === outcome;
                return (
                  <button
                    key={outcome}
                    type="button"
                    onClick={() => onChange({ finalOutcome: outcome })}
                    className="rounded-lg border-2 px-6 py-3 text-sm font-medium transition-all duration-150 ease-out select-none"
                    style={
                      active
                        ? { borderColor: GAF_RED, backgroundColor: '#FEF2F2', color: GAF_RED, transform: 'scale(1.02)', boxShadow: '0 4px 12px rgba(229,32,32,0.15)' }
                        : { borderColor: '#E5E7EB', backgroundColor: '#fff', color: '#374151' }
                    }
                    onMouseEnter={e => hoverIn(e, active)}
                    onMouseLeave={e => hoverOut(e, active)}
                    onMouseDown={press}
                    onMouseUp={release}
                  >
                    {outcome}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
