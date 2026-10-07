# Contracts: Warm look, step 2 of 2 (page header copy) + PTO description + file map

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.**

- Contracts description becomes "Tenure milestones and contract end dates." (Saul: drop "one row
  per employee"); the grey "N employees · N ending" text next to Export goes (the chips show both);
  Export stays an outline button.
- PTO Tracker description becomes "Accrual, requests and floating holidays." (one edit).
- `src/AGENTS.md` file map: the `/contracts` line lists the new files (one edit).

**Only these three files may change:** `src/app/pages/Contracts.tsx` (whole file below), exactly one
edit in `src/app/pages/PtoTracker.tsx`, exactly one edit in `src/AGENTS.md`. No other file may be
touched.

## `src/app/pages/Contracts.tsx` (whole file)

```tsx
import { useState } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageHeader from '@/app/components/PageHeader';
import ContractsTable from './contracts/ContractsTable';
import type { ContractRowData } from './contracts/ContractRow';
import { toLocalYMD } from '@/app/lib/classificationEngine';

export default function Contracts() {
  const [asOf] = useState(() => toLocalYMD(new Date()));
  const [rows, setRows] = useState<ContractRowData[]>([]);
  const [counts, setCounts] = useState<{ employees: number; expiring: number; offBoard: number } | null>(null);

  const handleExport = () => {
    const header = ['Employee', 'Position', 'State', 'Start', 'Tenure', '1m', '3m', '6m', '1y', '2y', 'Contract end', 'Status', 'Days until'];
    const data = rows.map(r => {
      let status = '';
      if (r.endState.kind === 'ended') {
        status = r.renewal === 'renewed' ? 'Renewed' : r.renewal === 'not_renewed' ? 'Not renewed' : 'Pending review';
      } else if (r.endState.kind === 'future') {
        const decided = r.renewal === 'renewed' ? ' · renewed' : r.renewal === 'not_renewed' ? ' · not renewed' : '';
        status = `Ending in ${r.endState.days ?? 0} days${decided}`;
      }
      return [
        r.display_name,
        r.position ?? '',
        r.state ?? '',
        r.start ?? '',
        r.tenure ?? '',
        r.ms?.[0]?.date ?? '',
        r.ms?.[1]?.date ?? '',
        r.ms?.[2]?.date ?? '',
        r.ms?.[3]?.date ?? '',
        r.ms?.[4]?.date ?? '',
        r.end ?? '',
        status,
        r.endState.kind !== 'none' ? (r.endState.days ?? '') : '',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    XLSX.writeFile(wb, `contracts-${asOf}.xlsx`);
  };

  // Warm redesign (2026-10-07): the employee and "ending within 30 days" counts moved to the
  // summary chips above the table; Export stays an outline button and exports the rows shown.
  const actions = (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={rows.length === 0}
      >
        <Download className="w-3.5 h-3.5 mr-1" />
        Export
      </Button>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Contracts"
        subtitle="Tenure milestones and contract end dates."
        actions={actions}
      />

      {/* Off-board notice — only when count > 0 */}
      {counts && counts.offBoard > 0 && (
        <div className="mx-6 mt-0 mb-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-[12px] text-amber-700 flex items-center gap-1">
          <span>
            {counts.offBoard} {counts.offBoard === 1 ? 'employee is' : 'employees are'} not on the Onboarding board — fix in Admin →{' '}
          </span>
          <Link
            to="/admin/employees?tab=monday"
            className="underline underline-offset-2 hover:text-amber-900 focus-visible:ring-2 focus-visible:ring-warm-ring rounded"
          >
            Employees → Monday
          </Link>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <ContractsTable
          asOf={asOf}
          onRowsChange={setRows}
          onCountsChange={setCounts}
        />
      </div>
    </div>
  );
}
```

## `src/app/pages/PtoTracker.tsx`: one edit

Replace exactly `        subtitle="Accrual, requests and floating holidays, one row per employee."` with exactly
`        subtitle="Accrual, requests and floating holidays."`

## `src/AGENTS.md`: one edit

Replace exactly this line:

```
`/contracts` — `contracts/ContractsTable.tsx`, `ContractRow.tsx`
```

with exactly:

```
`/contracts` — `contracts/ContractsTable.tsx` (loads, filters, summary chips, sorts), `ContractsChips.tsx`, `ContractRow.tsx`, `ContractCells.tsx` (milestone and contract-end cells); chip counting and labels in `lib/contractChips.ts`. Dates use `lib/fmtDay.ts`.
```

## Report
- Byte size of the three files; confirm no other file changed; Contracts and PTO Tracker show the
  new descriptions; no console errors.
