import { useState, useRef, useId, useCallback } from 'react';

interface Option {
  name: string;
  role?: string | null;
  manager?: string | null;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export default function EmployeeSearchInput({
  value,
  onChange,
  options,
  placeholder,
  className,
}: Props) {
  const [open, setOpen]       = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim();

  const matches: Option[] = trimmed
    ? options
        .filter(o => o.name.toLowerCase().includes(trimmed.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8)
    : [];

  // If only one match and it equals value exactly, suppress
  const suggestions =
    matches.length === 1 && matches[0].name === value ? [] : matches;

  const showList = open && suggestions.length > 0;

  const pick = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
    },
    [onChange],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = activeIdx >= 0 ? activeIdx : 0;
      pick(suggestions[idx].name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls={listId}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={e => {
          onChange(e.target.value);
          setActiveIdx(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActiveIdx(-1);
        }}
        onKeyDown={handleKeyDown}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          onMouseDown={e => e.preventDefault()}
          className="absolute left-0 top-full mt-1 w-64 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg z-50 py-1"
        >
          {suggestions.map((opt, i) => {
            const meta = [opt.role, opt.manager].filter(Boolean).join(' · ');
            const isActive = i === activeIdx;
            return (
              <li
                key={opt.name}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(opt.name)}
                className={[
                  'px-3 py-1.5 text-[13px] cursor-pointer',
                  isActive ? 'bg-slate-100' : 'hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="text-slate-800">{opt.name}</div>
                {meta && (
                  <div className="text-[11px] text-slate-400">{meta}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
