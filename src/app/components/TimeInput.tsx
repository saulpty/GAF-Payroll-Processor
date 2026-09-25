import { useState } from 'react';
import { parseTimeInput, isValidTimeInput } from '@/app/lib/parseTimeInput';

type Props = {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  /** Called on blur with whether the text is a real time (blank counts as valid). */
  onValidityChange?: (ok: boolean) => void;
};

export function TimeInput({ value, onChange, className = '', placeholder, onValidityChange }: Props) {
  const [bad, setBad] = useState(false);

  const handleBlur = () => {
    const ok = isValidTimeInput(value);
    setBad(!ok);
    onValidityChange?.(ok);
    if (!ok || !value.trim()) return;
    const formatted = parseTimeInput(value);
    if (formatted && formatted !== value) onChange(formatted);
  };

  return (
    <span className="inline-flex flex-col">
      <input
        type="text"
        value={value}
        placeholder={placeholder ?? 'e.g. 9:00 AM'}
        aria-invalid={bad || undefined}
        title={bad ? 'Not a real time' : undefined}
        onChange={e => { if (bad) setBad(false); onChange(e.target.value); }}
        onBlur={handleBlur}
        className={`${className} ${bad ? '!border-red-600 !bg-red-50 !text-red-700 ring-2 ring-red-600/15' : ''}`}
      />
      {bad && <span className="mt-0.5 text-[11px] font-medium text-red-700">Not a real time</span>}
    </span>
  );
}
