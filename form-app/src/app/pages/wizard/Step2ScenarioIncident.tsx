import React from 'react';
import { FileSearch, CheckSquare, MessageSquare } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DisciplinaryFormData,
  SCENARIO_LABELS,
  SCENARIO_DESCRIPTIONS,
  SCENARIO_EMOJIS,
  SCENARIO_PLACEHOLDERS,
  QuestionKey,
  SCENARIOS,
  EVIDENCE_OPTIONS,
  EvidenceType,
  ScenarioType,
} from '@/app/utils/disciplinaryFormData';

const GAF_RED = '#E52020';

interface Props {
  data: DisciplinaryFormData;
  onChange: (updates: Partial<DisciplinaryFormData>) => void;
  errors: Record<string, string>;
}

export default function Step2ScenarioIncident({ data, onChange, errors }: Props) {
  const toggleEvidence = (ev: EvidenceType) => {
    const current = data.evidenceTypes;
    const next = current.includes(ev) ? current.filter(e => e !== ev) : [...current, ev];
    onChange({ evidenceTypes: next });
  };

  const labels = data.scenario && data.scenario !== ''
    ? SCENARIO_LABELS[data.scenario as Exclude<ScenarioType, ''>]
    : null;

  const placeholders = data.scenario && data.scenario !== ''
    ? SCENARIO_PLACEHOLDERS[data.scenario as Exclude<ScenarioType, ''>]
    : null;

  const questionKeys: QuestionKey[] = ['qExpected', 'qHappened', 'qWhen', 'qImpact'];

  return (
    <div className="space-y-6">
      {/* Scenario */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <FileSearch size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Scenario</span>
        </div>
        <Label className="sr-only">Scenario <span style={{ color: GAF_RED }}>*</span></Label>
        {errors.scenario && <p className="text-xs text-red-500">{errors.scenario}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map(sc => {
            const active = data.scenario === sc;
            return (
              <button
                key={sc}
                type="button"
                onClick={() => onChange({ scenario: sc, qExpected: '', qHappened: '', qWhen: '', qImpact: '' })}
                className="rounded-lg border-2 px-3 py-3 text-sm font-medium text-left transition-all duration-150 ease-out select-none"
                style={
                  active
                    ? { borderColor: GAF_RED, backgroundColor: '#FEF2F2', color: GAF_RED, transform: 'scale(1.02)', boxShadow: '0 4px 12px rgba(229,32,32,0.15)' }
                    : { borderColor: '#E5E7EB', backgroundColor: '#fff', color: '#374151' }
                }
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 10px rgba(0,0,0,0.08)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#D1D5DB';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB';
                  }
                }}
                onMouseDown={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
                }}
                onMouseUp={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = active ? 'scale(1.02)' : 'scale(1.02)';
                }}
              >
                <span className="block text-base mb-0.5">{SCENARIO_EMOJIS[sc]}</span>
                <span className="block font-semibold leading-tight">{sc}</span>
                <span className="block text-xs mt-1 font-normal leading-snug" style={{ color: active ? '#b91c1c' : '#6B7280' }}>
                  {SCENARIO_DESCRIPTIONS[sc]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario questions */}
      {labels && placeholders && (
        <div className="space-y-4 border-l-4 pl-4" style={{ borderColor: GAF_RED }}>
          {questionKeys.map((field, idx) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={field}>
                {labels[idx]} <span style={{ color: GAF_RED }}>*</span>
              </Label>
              <Textarea
                id={field}
                rows={3}
                placeholder={placeholders[field]}
                value={data[field] as string}
                onChange={e => onChange({ [field]: e.target.value })}
                className={errors[field] ? 'border-red-500' : ''}
              />
              {errors[field] && <p className="text-xs text-red-500">{errors[field]}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Evidence */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <CheckSquare size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Evidence Reviewed</span>
        </div>
        <Label className="sr-only">Evidence Reviewed <span style={{ color: GAF_RED }}>*</span></Label>
        {errors.evidenceTypes && <p className="text-xs text-red-500">{errors.evidenceTypes}</p>}
        <div className="flex flex-wrap gap-2">
          {EVIDENCE_OPTIONS.map(ev => {
            const checked = data.evidenceTypes.includes(ev);
            return (
              <button
                key={ev}
                type="button"
                onClick={() => toggleEvidence(ev)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ease-out select-none"
                style={
                  checked
                    ? { borderColor: GAF_RED, backgroundColor: GAF_RED, color: '#fff', transform: 'scale(1.05)', boxShadow: '0 2px 8px rgba(229,32,32,0.25)' }
                    : { borderColor: '#D1D5DB', backgroundColor: '#fff', color: '#4B5563' }
                }
                onMouseEnter={e => {
                  if (!checked) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                  }
                }}
                onMouseLeave={e => {
                  if (!checked) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  }
                }}
                onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = checked ? 'scale(1.05)' : 'scale(1.05)'; }}
              >
                {ev}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <MessageSquare size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Evidence Description</span>
        </div>
        <div className="space-y-1.5">
        <Label htmlFor="evidenceDescription">Evidence Description</Label>
        <Textarea
          id="evidenceDescription"
          rows={3}
          placeholder="Describe the evidence reviewed..."
          value={data.evidenceDescription}
          onChange={e => onChange({ evidenceDescription: e.target.value })}
        />
        </div>
      </div>
    </div>
  );
}
