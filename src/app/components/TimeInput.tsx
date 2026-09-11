import { parseTimeInput } from '@/app/lib/parseTimeInput';

type Props = {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
};

export function TimeInput({ value, onChange, className = '', placeholder }: Props) {
  const handleBlur = () => {
    if (!value.trim()) return;
    const formatted = parseTimeInput(value);
    if (formatted && formatted !== value) onChange(formatted);
  };

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder ?? 'e.g. 9:00 AM'}
      onChange={e => onChange(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  );
}
