import React from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { FilerStatus } from '@/app/hooks/useFilerScope';

const GAF_RED = '#E52020';

interface Props {
  value: string;
  employees: string[];
  status: FilerStatus;
  error?: string;
  onSelect: (name: string) => void;
}

const STATUS_MESSAGES: Partial<Record<FilerStatus, string>> = {
  filerError: 'Couldn\'t check who is signed in — reload the page.',
  notSignedIn: 'You\'re not signed in. Sign in with your work email and reload the page.',
  mondayError: 'Couldn\'t load employees from Monday — reload the page.',
  empty: 'No employees are assigned to you in the Monday directory. Ask Saul or Tim.',
};

export default function EmployeePicker({ value, employees, status, error, onSelect }: Props) {
  const message = status === 'loading' ? 'Loading your employees from Monday…' : STATUS_MESSAGES[status];

  return (
    <div className="space-y-1.5">
      <Label htmlFor="employeeName">
        Employee <span style={{ color: GAF_RED }}>*</span>
      </Label>

      {message && (
        <div
          className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            status === 'loading'
              ? 'text-muted-foreground'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}
        >
          {status !== 'loading' && <Info size={13} className="shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      <select
        id="employeeName"
        value={value}
        onChange={e => onSelect(e.target.value)}
        disabled={status !== 'ready'}
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-opacity ${
          status !== 'ready' ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''
        } ${error ? 'border-red-500' : 'border-input'}`}
      >
        <option value="">— Select employee —</option>
        {employees.map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
