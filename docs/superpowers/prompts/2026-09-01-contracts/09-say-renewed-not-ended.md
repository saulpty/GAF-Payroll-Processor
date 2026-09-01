# Say "Renewed", not "ended"

**Modify exactly these two existing files:**

- `src/app/pages/contracts/ContractRow.tsx`
- `src/app/pages/Contracts.tsx`

**No other file may be created, modified or deleted.**

Specifically **do not touch `src/app/lib/tenure.ts`.** Its `contractEndState`
returns `kind: 'ended'` and that stays correct — the module only knows a date
has passed. The *interpretation* belongs to the page, which also knows the
person is still employed. Seventeen tests pin that module. Also leave
`ContractsTable.tsx`, both `loadContract*` actions, and all sorting and
filtering exactly as they are.

## Why

The Contract end column currently reads `ended 05-19-2026` on 31 of the 44 rows.
That is misleading. **Every row on this page is an active employee** — the
action filters on `e.active = true`, which is written from the Directory's
*Current Employees* group. So a contract end date in the past does not mean the
person left. It means their fixed term finished **and they are still here**: the
contract was renewed, or they moved to an indefinite one and nobody updated the
board.

Saul's words: *"if someone contract ends but it was continued aka they still
work with us just say renewed."*

## 1. `ContractRow.tsx` — the cell

Where `endState.kind === 'ended'`, render **`Renewed`** in place of
`ended MM-DD-YYYY`.

Keep the original date, because it is useful — it is when the fixed term ran
out. Put it on a second line in smaller muted text, the same two-line shape the
milestone cells already use for a date plus `in N d`:

```
Renewed
was 05-19-2026
```

`Renewed` stays **muted and uncoloured** — no chip, no red, no amber. It is the
normal state for most of the roster and must not compete with the one row that
needs attention.

Give the cell a `title` explaining the inference, in plain words:
`Their fixed term ended on 05-19-2026 and they are still on the active roster.`

Nothing else about the cell changes:

- `future` and `days <= 30` → red chip, `MM-DD-YYYY · in N d`
- `future` and `days <= 60` → amber chip, same text
- `future`, further out → plain date, no chip
- `none` → `—`

## 2. `Contracts.tsx` — keep the export honest

The sheet currently writes `Contract end` (a date) and `Days until` (signed).
Add one column, `Status`, between them:

| row kind | Status |
|---|---|
| `ended` | `Renewed` |
| `future` | `Ending in N days` |
| `none` | empty |

The header row becomes:

`Employee, Position, State, Start, Tenure, 1m, 3m, 6m, 1y, 2y, Contract end, Status, Days until`

Leave `Contract end` as the plain date and `Days until` as the signed number, so
the sheet can still be sorted by urgency.

## One thing to be honest about

This infers renewal from *"the term ended and they are still on the active
roster."* It does not read a renewal date from Monday, because the board does
not carry one. If somebody has actually left but the Directory still lists them
as current, this row will say `Renewed` when it should not. That is a
Directory-accuracy problem rather than a Contracts-page one, and `Renewed` is
still the right default.

## Acceptance

- Two files changed, nothing else. `tenure.ts` untouched; suite still 121/121.
- Ulla Hees reads `Renewed` above `was 05-19-2026`, muted, no chip.
- 31 of the 44 rows read `Renewed`.
- Carlos Aloma is unchanged — red chip, `09-02-2026 · in 1 d`, still first.
- The word "ended" appears nowhere on the page.
- Export opens with the new `Status` column reading `Renewed` on those 31 rows.
