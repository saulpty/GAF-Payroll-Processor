import React, { useState, useRef, useEffect } from 'react';
import { useLoadAction } from '@uibakery/data';
import { X, UserCheck, Calendar, Users, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  DisciplinaryFormData,
  EMPLOYEES,
  WARNING_LEVELS,
  WarnLevel,
} from '@/app/utils/disciplinaryFormData';
import { useMondayAutofill } from '@/app/hooks/useMondayAutofill';
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

const FALLBACK_EMPLOYEES = EMPLOYEES.map(e => e.name).sort();

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
  const { managerMap, employeePositionMap, employeeBranchMap, allEmployees, managers, loading: mondayLoading } = useMondayAutofill();

  const [managerInput, setManagerInput] = useState(data.managerName);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const suggestRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    setManagerInput(data.managerName);
  }, [data.managerName]);

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

  const filteredManagers = managerInput.trim().length > 0
    ? managers.filter(m => m.toLowerCase().includes(managerInput.toLowerCase()))
    : managers;

  const matchedManager = managerMap.get(data.managerName);

  const baseEmployeeList: string[] = matchedManager
    ? matchedManager.reports.slice().sort()
    : (allEmployees.length > 0 ? allEmployees : FALLBACK_EMPLOYEES);

  const employeeList: string[] =
    data.employeeName && !baseEmployeeList.includes(data.employeeName)
      ? [data.employeeName, ...baseEmployeeList]
      : baseEmployeeList;

  // Manager must be typed before employee can be selected
  const managerEntered = data.managerName.trim().length > 0;

  const handleManagerInput = (value: string) => {
    setManagerInput(value);
    setHighlightIdx(-1);
    setShowSuggestions(true);
    if (!value.trim()) {
      onChange({ managerName: '', managerEmail: '' });
      return;
    }
    const exact = managerMap.get(value);
    if (exact) {
      onChange({ managerName: value, managerEmail: exact.email });
    } else {
      onChange({ managerName: value });
    }
  };

  const selectManager = (name: string) => {
    const info = managerMap.get(name);
    setManagerInput(name);
    setShowSuggestions(false);
    onChange({
      managerName: name,
      managerEmail: info?.email ?? data.managerEmail,
      ...(matchedManager && !info?.reports.includes(data.employeeName)
        ? { employeeName: '', employeeRole: '', employeeBranch: '' }
        : {}),
    });
  };

  const handleManagerKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredManagers.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filteredManagers.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightIdx >= 0) { e.preventDefault(); selectManager(filteredManagers[highlightIdx]); }
    else if (e.key === 'Escape') { setShowSuggestions(false); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleEmployeeChange = (name: string) => {
    const mondayPos = employeePositionMap.get(name);
    const mondayBranch = employeeBranchMap.get(name);
    const fallbackEmp = EMPLOYEES.find(e => e.name === name);
    onChange({
      employeeName: name,
      employeeRole: mondayPos ?? fallbackEmp?.role ?? '',
      employeeBranch: mondayBranch ?? fallbackEmp?.branch ?? '',
    });
  };

  return (
    <div className="space-y-6">

      {/* ── Manager Section ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <UserCheck size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Manager Information</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Manager Name */}
          <div className="space-y-1.5 relative">
            <Label htmlFor="managerName">
              Manager Name <span style={{ color: GAF_RED }}>*</span>
              {mondayLoading && <span className="ml-2 text-[10px] text-muted-foreground">loading…</span>}
            </Label>
            <Input
              id="managerName"
              ref={inputRef}
              value={managerInput}
              autoComplete="off"
              onChange={e => handleManagerInput(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleManagerKeyDown}
              placeholder="Type manager name…"
              className={errors.managerName ? 'border-red-500' : ''}
            />
            {showSuggestions && filteredManagers.length > 0 && (
              <div
                ref={suggestRef}
                className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredManagers.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); selectManager(m); }}
                    className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                    style={i === highlightIdx ? { backgroundColor: '#FEF2F2', color: GAF_RED } : {}}
                  >
                    <span className="font-medium">{m}</span>
                    {managerMap.get(m)?.email && (
                      <span className="ml-2 text-xs text-muted-foreground">{managerMap.get(m)?.email}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {errors.managerName && <p className="text-xs text-red-500">{errors.managerName}</p>}
          </div>

          {/* Manager Email */}
          <div className="space-y-1.5">
            <Label htmlFor="managerEmail">
              Manager Email <span style={{ color: GAF_RED }}>*</span>
            </Label>
            <Input
              id="managerEmail"
              type="email"
              value={data.managerEmail}
              onChange={e => onChange({ managerEmail: e.target.value })}
              placeholder="manager@gafhealthcare.com"
              className={errors.managerEmail ? 'border-red-500' : ''}
            />
            {errors.managerEmail && <p className="text-xs text-red-500">{errors.managerEmail}</p>}
          </div>
        </div>
      </div>

      {/* Manager match badge */}
      {matchedManager && (
        <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <UserCheck size={13} className="text-green-600 shrink-0" />
          <span className="text-green-700 font-semibold">Manager matched from Monday.com</span>
          <span className="text-green-600">· Showing {matchedManager.reports.length} employee{matchedManager.reports.length !== 1 ? 's' : ''} you manage</span>
        </div>
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

        <div className="space-y-1.5">
          <Label htmlFor="employeeName">
            Employee <span style={{ color: GAF_RED }}>*</span>
            {matchedManager && (
              <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                (filtered to {matchedManager.name}'s employees)
              </span>
            )}
          </Label>

          {!managerEntered && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
              <Info size={13} className="shrink-0" />
              <span>Please enter the manager's name first to enable employee selection.</span>
            </div>
          )}

          <select
            id="employeeName"
            value={data.employeeName}
            onChange={e => handleEmployeeChange(e.target.value)}
            disabled={!managerEntered}
            className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity ${
              !managerEntered ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''
            } ${errors.employeeName ? 'border-red-500' : 'border-input'}`}
          >
            <option value="">— Select employee —</option>
            {employeeList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {errors.employeeName && <p className="text-xs text-red-500">{errors.employeeName}</p>}
        </div>

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
