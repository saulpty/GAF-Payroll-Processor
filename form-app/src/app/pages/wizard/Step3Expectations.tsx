import React from 'react';
import { History, Target, AlertOctagon, CalendarCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { DisciplinaryFormData } from '@/app/utils/disciplinaryFormData';

const GAF_RED = '#E52020';

interface Props {
  data: DisciplinaryFormData;
  onChange: (updates: Partial<DisciplinaryFormData>) => void;
  errors: Record<string, string>;
}

export default function Step3Expectations({ data, onChange, errors }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <History size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Prior Warnings or Discussions</span>
        </div>
        <div className="space-y-1.5">
        <Label htmlFor="priorWarnings" className="sr-only">
          Prior Warnings or Discussions <span style={{ color: GAF_RED }}>*</span>
        </Label>
        <Textarea
          id="priorWarnings"
          rows={3}
          placeholder="Describe any prior warnings or discussions..."
          value={data.priorWarnings}
          onChange={e => onChange({ priorWarnings: e.target.value })}
          className={errors.priorWarnings ? 'border-red-500' : ''}
        />
        {errors.priorWarnings && <p className="text-xs text-red-500">{errors.priorWarnings}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <Target size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">What the employee must correct starting today</span>
        </div>
        <div className="space-y-1.5">
        <Label htmlFor="expectations" className="sr-only">
          What the employee must correct starting today <span style={{ color: GAF_RED }}>*</span>
        </Label>
        <Textarea
          id="expectations"
          rows={4}
          placeholder="List expected corrections..."
          value={data.expectations}
          onChange={e => onChange({ expectations: e.target.value })}
          className={errors.expectations ? 'border-red-500' : ''}
        />
        {errors.expectations && <p className="text-xs text-red-500">{errors.expectations}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <AlertOctagon size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Consequences of Non-compliance</span>
        </div>
        <div className="space-y-1.5">
        <Label htmlFor="consequences" className="sr-only">
          Consequences of Non-compliance <span style={{ color: GAF_RED }}>*</span>
        </Label>
        <Textarea
          id="consequences"
          rows={3}
          placeholder="Describe the consequences if expectations are not met..."
          value={data.consequences}
          onChange={e => onChange({ consequences: e.target.value })}
          className={errors.consequences ? 'border-red-500' : ''}
        />
        {errors.consequences && <p className="text-xs text-red-500">{errors.consequences}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
          <CalendarCheck size={15} style={{ color: GAF_RED }} />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Re-evaluation Date</span>
        </div>
        <div className="space-y-1.5">
        <Label htmlFor="revaluationDate" className="sr-only">
          Re-evaluation Date <span style={{ color: GAF_RED }}>*</span>
        </Label>
        <Input
          id="revaluationDate"
          type="date"
          value={data.revaluationDate}
          onChange={e => onChange({ revaluationDate: e.target.value })}
          className={`max-w-xs ${errors.revaluationDate ? 'border-red-500' : ''}`}
        />
        {errors.revaluationDate && <p className="text-xs text-red-500">{errors.revaluationDate}</p>}
        </div>
      </div>
    </div>
  );
}
