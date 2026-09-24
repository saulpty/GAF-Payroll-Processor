import React from 'react';
import { UserCheck, FileText, Target, ClipboardCheck } from 'lucide-react';

const GAF_RED = '#E52020';

export const STEPS = [
  { num: 1, label: 'Employee & Warning', Icon: UserCheck },
  { num: 2, label: 'Scenario & Incident', Icon: FileText },
  { num: 3, label: 'Expectations', Icon: Target },
  { num: 4, label: 'Review & Submit', Icon: ClipboardCheck },
];

export default function StepProgress({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((s, i) => {
        const done = step > s.num;
        const active = step === s.num;
        return (
          <React.Fragment key={s.num}>
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  done
                    ? 'text-white'
                    : active
                    ? 'bg-white'
                    : 'border-gray-300 bg-white text-gray-400'
                }`}
                style={
                  done
                    ? { borderColor: GAF_RED, backgroundColor: GAF_RED }
                    : active
                    ? { borderColor: GAF_RED, color: GAF_RED }
                    : {}
                }
              >
                {done ? '✓' : React.createElement(s.Icon, { size: 14 })}
              </div>
              <span
                className={`text-xs text-center hidden sm:block font-sans ${active ? 'font-bold' : done ? 'text-gray-600' : 'text-gray-400'}`}
                style={active ? { color: GAF_RED } : {}}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 flex-1 mx-1 transition-colors"
                style={{ backgroundColor: done ? GAF_RED : '#E5E7EB' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
