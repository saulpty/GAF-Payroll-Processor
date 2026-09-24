// Edit form for one disciplinary action (Tim and Saul only), box by box.
// Employee, manager and ref are shown but cannot change. After a save the
// form is replaced by EditResultPanel. Dates are 'YYYY-MM-DD' strings,
// compared as strings; never new Date(str).
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import { WARNING_LEVELS, FINAL_OUTCOMES, SCENARIOS, EVIDENCE_OPTIONS } from '@/app/lib/disciplinaryOptions';
import { questionLabels, evidenceList } from '@/app/lib/disciplinaryPdf/strings';
import { useSaveDisciplinaryEdit } from './useSaveDisciplinaryEdit';
import type { EditValues } from './useSaveDisciplinaryEdit';
import EditResultPanel from './EditResultPanel';

interface Props {
  action: DisciplinaryRow;
  onCancel: () => void;
  onDone: () => void;   // after a save: close the editor and reload the list
  onSaved?: () => void;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const SELECT = 'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-sm';

function initialValues(a: DisciplinaryRow): EditValues {
  return {
    document_date: (a.document_date ?? '').slice(0, 10),
    revaluation_date: (a.revaluation_date ?? '').slice(0, 10),
    warning_level: a.warning_level ?? '',
    final_outcome: a.final_outcome ?? '',
    scenario: a.scenario ?? '',
    q_expected: a.q_expected ?? '',
    q_happened: a.q_happened ?? '',
    q_when: a.q_when ?? '',
    q_impact: a.q_impact ?? '',
    evidence_types: evidenceList(a.evidence_types),
    evidence_description: a.evidence_description ?? '',
    prior_warnings: a.prior_warnings ?? '',
    expectations: a.expectations ?? '',
    consequences: a.consequences ?? '',
    employee_role: a.employee_role ?? '',
    employee_branch: a.employee_branch ?? '',
  };
}

function problem(v: EditValues): string | null {
  if (!YMD.test(v.document_date)) return 'Document date is required.';
  if (v.revaluation_date && !YMD.test(v.revaluation_date)) return 'Re-evaluation date is not a valid date.';
  if (v.revaluation_date && v.revaluation_date < v.document_date) {
    return "Re-evaluation date can't be before the document date.";
  }
  if (!v.warning_level) return 'Choose a warning level.';
  return null;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export default function EditActionForm({ action, onCancel, onDone, onSaved }: Props) {
  const [v, setV] = useState<EditValues>(() => initialValues(action));
  const { save, retryEmail, saving, sending, error, result } = useSaveDisciplinaryEdit(action);

  useEffect(() => {
    if (result) onSaved?.();
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (result) {
    return <EditResultPanel result={result} sending={sending} onRetry={retryEmail} onDone={onDone} />;
  }

  const set = (k: keyof EditValues) => (e: { target: { value: string } }) =>
    setV(prev => ({ ...prev, [k]: e.target.value }));

  function toggleEvidence(opt: string) {
    setV(prev => ({
      ...prev,
      evidence_types: prev.evidence_types.includes(opt)
        ? prev.evidence_types.filter(x => x !== opt)
        : [...prev.evidence_types, opt],
    }));
  }

  // Keep any value already saved that is not on today's lists, so an edit never drops it.
  const levels = WARNING_LEVELS.includes(v.warning_level) || !v.warning_level ? WARNING_LEVELS : [v.warning_level, ...WARNING_LEVELS];
  const scenarios = SCENARIOS.includes(v.scenario) || !v.scenario ? SCENARIOS : [v.scenario, ...SCENARIOS];
  const outcomes = FINAL_OUTCOMES.includes(v.final_outcome) ? FINAL_OUTCOMES : [...FINAL_OUTCOMES, v.final_outcome];
  const evidence = [...EVIDENCE_OPTIONS, ...v.evidence_types.filter(x => !EVIDENCE_OPTIONS.includes(x))];
  const q = questionLabels(v.scenario);
  const invalid = problem(v);

  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-[12px] text-slate-500">
        {action.employee_name} &middot; filed by {action.manager_name ?? 'unknown'} &middot; <span className="font-mono">{action.ref}</span>
        <span className="text-slate-400"> (these cannot be changed; to change who a warning is about, delete it and file a new one)</span>
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Document date">
          <Input type="date" value={v.document_date} onChange={set('document_date')} disabled={saving} className="mt-1 h-8 text-sm" />
        </Field>
        <Field label="Re-evaluation date">
          <Input type="date" value={v.revaluation_date} onChange={set('revaluation_date')} disabled={saving} className="mt-1 h-8 text-sm" />
        </Field>
        <Field label="Role">
          <Input value={v.employee_role} onChange={set('employee_role')} disabled={saving} className="mt-1 h-8 text-sm" />
        </Field>
        <Field label="Branch">
          <Input value={v.employee_branch} onChange={set('employee_branch')} disabled={saving} className="mt-1 h-8 text-sm" />
        </Field>
        <Field label="Warning level">
          <select value={v.warning_level} onChange={set('warning_level')} disabled={saving} className={SELECT}>
            {!v.warning_level && <option value="">Choose&hellip;</option>}
            {levels.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Final outcome">
          <select value={v.final_outcome} onChange={set('final_outcome')} disabled={saving} className={SELECT}>
            {outcomes.map(o => <option key={o || 'none'} value={o}>{o || 'None'}</option>)}
          </select>
        </Field>
        <Field label="Situation type">
          <select value={v.scenario} onChange={set('scenario')} disabled={saving} className={SELECT}>
            {!v.scenario && <option value="">Choose&hellip;</option>}
            {scenarios.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </div>

      <Field label={q[0]}><Textarea rows={3} value={v.q_expected} onChange={set('q_expected')} disabled={saving} className="mt-1 text-sm" /></Field>
      <Field label={q[1]}><Textarea rows={3} value={v.q_happened} onChange={set('q_happened')} disabled={saving} className="mt-1 text-sm" /></Field>
      <Field label={q[2]}><Textarea rows={2} value={v.q_when} onChange={set('q_when')} disabled={saving} className="mt-1 text-sm" /></Field>
      <Field label={q[3]}><Textarea rows={2} value={v.q_impact} onChange={set('q_impact')} disabled={saving} className="mt-1 text-sm" /></Field>

      <Field label="Evidence reviewed">
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {evidence.map(opt => (
            <label key={opt} className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
              <input type="checkbox" checked={v.evidence_types.includes(opt)} onChange={() => toggleEvidence(opt)} disabled={saving} />
              {opt}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Evidence description"><Textarea rows={2} value={v.evidence_description} onChange={set('evidence_description')} disabled={saving} className="mt-1 text-sm" /></Field>
      <Field label="Prior warnings or discussions"><Textarea rows={2} value={v.prior_warnings} onChange={set('prior_warnings')} disabled={saving} className="mt-1 text-sm" /></Field>
      <Field label="What the employee must correct starting today"><Textarea rows={3} value={v.expectations} onChange={set('expectations')} disabled={saving} className="mt-1 text-sm" /></Field>
      <Field label="Consequences of non-compliance"><Textarea rows={2} value={v.consequences} onChange={set('consequences')} disabled={saving} className="mt-1 text-sm" /></Field>

      {(error || invalid) && <p className="text-xs text-red-600">{error ?? invalid}</p>}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={() => save(v)} disabled={saving || invalid !== null} className="bg-[#BE123C] hover:bg-[#9F1239] text-white">
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving&hellip;</>
            : <><Save className="w-3.5 h-3.5 mr-1.5" />Save and email</>}
        </Button>
      </div>
    </div>
  );
}
