import { useEffect, useId, useState } from 'react';
import { parseTimeInput, isValidTimeInput } from '@/app/lib/parseTimeInput';

type Props = {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  /** Screen-reader name, e.g. "In, Ana López 2026-09-07" (the placeholder vanishes once typed in). */
  ariaLabel?: string;
  /** Called on blur with whether the text is a real time (blank counts as valid). */
  onValidityChange?: (ok: boolean) => void;
};

export function TimeInput({ value, onChange, className = '', placeholder, ariaLabel, onValidityChange }: Props) {
  const [bad, setBad] = useState(false);
  const errorId = useId();
  // Discard all, a bulk edit or a reload can replace the text from outside: clear the red then.
  useEffect(() => { if (bad && isValidTimeInput(value)) setBad(false); }, [value]);

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
        aria-label={ariaLabel}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? errorId : undefined}
        title={bad ? 'Not a real time' : undefined}
        onChange={e => { if (bad) setBad(false); onChange(e.target.value); }}
        onBlur={handleBlur}
        className={`${className} ${bad ? '!border-red-600 !bg-red-50 !text-red-700 ring-2 ring-red-600/15' : ''}`}
      />
      {bad && <span id={errorId} className="mt-0.5 text-[11px] font-medium text-red-700">Not a real time</span>}
    </span>
  );
}
