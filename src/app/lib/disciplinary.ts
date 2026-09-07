// Pure disciplinary-action rules for the Disciplinary page.
// No imports. Dates are 'YYYY-MM-DD' strings; timestamps are sliced to 10
// chars before use. See AGENTS.md §Timezone rules.
// The only permitted use of Date is Date.UTC(...) inside toDayNumber.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaseState = 'closed' | 'outcome' | 'overdue' | 'open';

export interface DisciplinaryRow {
  id: number;
  ref: string;
  employee_name: string;
  manager_name: string | null;
  employee_role: string | null;
  employee_branch: string | null;
  document_date: string | null;
  revaluation_date: string | null;
  warning_level: string | null;
  final_outcome: string | null;
  scenario: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closure_note: string | null;
  // Carried by the row but never read here. Optional so this module states
  // exactly what it depends on.
  manager_email?: string | null;
  q_expected?: string | null;
  q_happened?: string | null;
  q_when?: string | null;
  q_impact?: string | null;
  evidence_types?: string[] | null;
  evidence_description?: string | null;
  prior_warnings?: string | null;
  expectations?: string | null;
  consequences?: string | null;
  signature_drawn?: boolean | null;
  submitted_at?: string | null;
}

export interface EmployeeCase {
  employeeName: string;
  actions: DisciplinaryRow[];   // newest first
  highestRank: number;
  openCount: number;
  nextReval: string | null;
  latest: DisciplinaryRow;
  worstState: CaseState;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toDayNumber(d: string): number {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
}

// Converts a day-number (days since 1970-01-01 UTC) back to 'YYYY-MM-DD'.
// Uses only Date.UTC — no new Date(string), no Date.now().
function dayNumberToYMD(n: number): string {
  // Binary-search free: use the inverse of the Gregorian formula via Date.UTC.
  // Date.UTC accepts day overflow, so we can derive year from an approximation
  // then adjust. We use a simple epoch-offset approach:
  // epoch 1970-01-01 = day 0. Add n days in ms and extract via UTC arithmetic.
  // We stay in UTC throughout so no timezone shift occurs.
  const ms = n * 86400000;
  // To extract year/month/day from ms without new Date(), we replicate the
  // civil calendar algorithm (Proleptic Gregorian, only correct for dates
  // representable in JS's safe integer range, which includes all HR dates).
  // Algorithm: days from civil epoch 0000-03-01 offset.
  const z = Math.floor(ms / 86400000) + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = month <= 2 ? y + 1 : y;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Severity index: lower index = more severe (for sorting most-severe first).
const STATE_SEVERITY: Record<CaseState, number> = {
  overdue: 0,
  outcome: 1,
  open:    2,
  closed:  3,
};

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * levelRank — maps a warning-level string to an escalation rank.
 * Unrecognised values return -1.
 */
export function levelRank(level: string | null | undefined): number {
  switch (level) {
    case 'Verbal Warning':         return 0;
    case 'First Written Warning':  return 1;
    case 'Second Written Warning': return 2;
    case 'Final Written Warning':  return 3;
    default:                       return -1;
  }
}

/**
 * caseState — derives the display state for one row.
 * Evaluated strictly in order: closed → outcome → open(no reval) → overdue → open.
 */
export function caseState(row: DisciplinaryRow, asOf: string): CaseState {
  // 1. Closed beats everything.
  if (row.closed_at) return 'closed';

  // 2. Suspension or Termination as a final outcome.
  if (row.final_outcome === 'Suspension' || row.final_outcome === 'Termination') {
    return 'outcome';
  }

  // 3. No revaluation date → still open, never overdue.
  if (!row.revaluation_date) return 'open';

  // 4. Revaluation date is strictly before asOf → overdue.
  // Comparison is < (not <=): on the day itself the case is still open.
  if (row.revaluation_date.slice(0, 10) < asOf.slice(0, 10)) return 'overdue';

  // 5. Otherwise open.
  return 'open';
}

/**
 * daysBetween — plain calendar days. Negative when to < from.
 */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/**
 * groupByEmployee — one EmployeeCase per distinct employee_name.
 */
export function groupByEmployee(rows: DisciplinaryRow[], asOf: string): EmployeeCase[] {
  const asOf10 = asOf.slice(0, 10);

  // Build a map keyed by exact employee_name.
  const map = new Map<string, DisciplinaryRow[]>();
  for (const row of rows) {
    const key = row.employee_name;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      map.set(key, [row]);
    }
  }

  const cases: EmployeeCase[] = [];

  for (const [employeeName, actions] of map) {
    // Sort: document_date DESC (nulls last), then id DESC.
    const sorted = actions.slice().sort((a, b) => {
      const da = a.document_date ? a.document_date.slice(0, 10) : null;
      const db = b.document_date ? b.document_date.slice(0, 10) : null;
      if (da === null && db === null) return b.id - a.id;
      if (da === null) return 1;
      if (db === null) return -1;
      if (db !== da) return db < da ? -1 : 1;
      return b.id - a.id;
    });

    let highestRank = -1;
    let openCount = 0;
    let nextRevalDay: number | null = null;
    let nextReval: string | null = null;
    let worstSeverity = STATE_SEVERITY['closed']; // start at least severe

    for (const action of sorted) {
      const rank = levelRank(action.warning_level);
      if (rank > highestRank) highestRank = rank;

      const state = caseState(action, asOf10);
      if (state !== 'closed') openCount++;

      const sev = STATE_SEVERITY[state];
      if (sev < worstSeverity) worstSeverity = sev;

      // nextReval: soonest revaluation_date that is >= asOf, on non-closed actions.
      if (state !== 'closed' && action.revaluation_date) {
        const rd = action.revaluation_date.slice(0, 10);
        if (rd >= asOf10) {
          const rdn = toDayNumber(rd);
          if (nextRevalDay === null || rdn < nextRevalDay) {
            nextRevalDay = rdn;
            nextReval = rd;
          }
        }
      }
    }

    // Map severity index back to CaseState.
    const severityToState: CaseState[] = ['overdue', 'outcome', 'open', 'closed'];
    const worstState: CaseState = severityToState[worstSeverity];

    cases.push({
      employeeName,
      actions: sorted,
      highestRank,
      openCount,
      nextReval,
      latest: sorted[0],
      worstState,
    });
  }

  return cases;
}

/**
 * sortEmployeeCases — returns a new sorted array; does not mutate input.
 * Order: worstState severity asc, highestRank desc, latest.document_date desc (nulls last), employeeName asc.
 */
export function sortEmployeeCases(cases: EmployeeCase[]): EmployeeCase[] {
  return cases.slice().sort((a, b) => {
    // 1. worstState severity ascending (most severe first).
    const sa = STATE_SEVERITY[a.worstState];
    const sb = STATE_SEVERITY[b.worstState];
    if (sa !== sb) return sa - sb;

    // 2. highestRank descending.
    if (a.highestRank !== b.highestRank) return b.highestRank - a.highestRank;

    // 3. latest.document_date descending, nulls last.
    const da = a.latest.document_date ? a.latest.document_date.slice(0, 10) : null;
    const db = b.latest.document_date ? b.latest.document_date.slice(0, 10) : null;
    if (da === null && db === null) { /* fall through */ }
    else if (da === null) return 1;
    else if (db === null) return -1;
    else if (da !== db) return db < da ? -1 : 1;

    // 4. employeeName ascending.
    return a.employeeName.localeCompare(b.employeeName);
  });
}

/**
 * dueSoon — count of open actions with a revaluation_date within withinDays of asOf.
 * No lower bound: overdue cases keep counting.
 */
export function dueSoon(rows: DisciplinaryRow[], asOf: string, withinDays = 30): number {
  const asOf10 = asOf.slice(0, 10);
  // Compute windowEnd by adding withinDays to the asOf day-number, then
  // converting back to YYYY-MM-DD using the same toDayNumber / Date.UTC idiom
  // (Date.UTC normalises overflow day values, so we pass the raw sum).
  const [ay, am, ad] = asOf10.split('-').map(Number);
  // Date.UTC(y, m-1, d + extra) safely rolls over month/year boundaries.
  const windowMs = Date.UTC(ay, am - 1, ad + withinDays);
  // Extract components from the UTC millisecond value without new Date():
  // integer-divide by 86400000 to get the day number, then use the same
  // Gregorian algorithm used by toDayNumber in reverse.
  const windowEnd = dayNumberToYMD(Math.round(windowMs / 86400000));

  let count = 0;
  for (const row of rows) {
    if (row.closed_at) continue;
    if (!row.revaluation_date) continue;
    const rd = row.revaluation_date.slice(0, 10);
    if (rd <= windowEnd) count++;
  }
  return count;
}
