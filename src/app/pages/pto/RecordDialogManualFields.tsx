import { Label } from '@/components/ui/label';

interface Props {
  leaveType: 'pto' | 'floating_holiday';
  onLeaveType: (v: 'pto' | 'floating_holiday') => void;
  empId: number | null;
  onEmpId: (v: number | null) => void;
  employees: { id: number; display_name: string; active: boolean }[];
}

export default function RecordDialogManualFields({
  leaveType, onLeaveType, empId, onEmpId, employees,
}: Props) {
  return (
    <>
      {/* Type */}
      <div>
        <Label className="text-xs text-slate-500">Type</Label>
        <select
          value={leaveType}
          onChange={e => onLeaveType(e.target.value as 'pto' | 'floating_holiday')}
          className="mt-1 block w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="pto">PTO</option>
          <option value="floating_holiday">Floating holiday</option>
        </select>
      </div>

      {/* Employee */}
      <div>
        <Label className="text-xs text-slate-500">Employee</Label>
        <select
          value={empId ?? ''}
          onChange={e => onEmpId(e.target.value ? Number(e.target.value) : null)}
          className="mt-1 block w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Select employee…</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>
              {e.display_name}{e.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
