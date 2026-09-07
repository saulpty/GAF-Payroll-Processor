# Make the expanded row a compact list, not a wall of text

**Modify exactly one file and create exactly one:**

- modify `src/app/pages/disciplinary/CaseFile.tsx`
- create `src/app/pages/disciplinary/ActionDetail.tsx`

**No other file may be created, modified or deleted.** Do not touch
`DisciplinaryTable.tsx`, `DisciplinaryRow.tsx`, `CloseCaseDialog.tsx`,
`Disciplinary.tsx`, any action, `src/app/lib/disciplinary.ts`, `app.tsx`,
`TopNav.tsx`, `FilterBar.tsx`, or anything under `src/components/ui/`.

## Why

Expanding an employee currently prints **every narrative field of every action
at full length, all at once**. For someone with three actions that is eighteen
paragraphs with no way to skim. The owner's verdict: *"this is kinda hard to
read."*

There is a second problem making it worse. The expanded view opens with a header
strip — Actions, Highest level, Escalation, Last action — that **repeats what the
collapsed row already shows one line above it.** The reader pays for that
duplication before reaching anything new.

## The shape it should have

Expanding an employee shows **a compact table of their actions, one line each**.
Expanding one of those lines shows that action's full detail. Nothing else.

```
▼ Juan Molina        Marcela Gordon    3   First Written  ●●○○  06-23-2026 …   review overdue 80 d
  ┌────────────────────────────────────────────────────────────────────────────────────┐
  │ 06-16-2026  Verbal Warning   Attendance / Tardiness   Juan has consistently arri…  │
  │             Marcela Gordon   re-eval 06-23-2026   overdue          ⌄               │
  │ 06-16-2026  Verbal Warning   Calls / Lead Follow-up   KPI metric for intake 1 st…  │
  │ 06-23-2026  First Written    Calls / Lead Follow-up   The employee received a ve…  │
  └────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Delete the header strip

Remove the Actions / Highest level / Escalation / Last action block entirely,
including the large escalation ladder. Every one of those values is already in
the employee row directly above. **Do not replace it with anything.**

### 2. `CaseFile.tsx` becomes a compact list

Same props as now — `{ actions, asOf, onChanged }`. Still renders the actions
**oldest first** (reverse a copy; do not mutate the prop).

Render a borderless inner table, one row per action, columns:

| Column | Content |
|---|---|
| Date | `fmtDate(document_date)`, `whitespace-nowrap` |
| Level | the level `StatusChip`, plus the `final_outcome` chip if non-empty |
| Scenario | plain muted text |
| What happened | `q_happened` **truncated to roughly 110 characters** with an ellipsis, `text-slate-500`, on one line, `truncate` so it never wraps |
| Manager | `manager_name` |
| Re-evaluation | `fmtDate(revaluation_date)`, or `—` when null |
| Status | a small chip from `caseState(action, asOf)`: `overdue` red, `outcome` red, `open` amber, `closed` green |
| | a chevron button, rotated when that action is expanded |

Row height should be one line. Use the same `text-[13px]` / `text-xs` scale the
rest of the app uses, and keep the inner table visually subordinate to the main
one — no heavy borders, no card shadow, a slightly inset background.

Track which single action is expanded in local state, keyed by `action.id`.
**One action open at a time**, the same rule the employee rows already follow.

### 3. `ActionDetail.tsx` — one action, in full

Props: `{ action, asOf, onChanged }`.

This is **the content that is in `CaseFile.tsx` today**, moved: the six labelled
facts (What was expected, What happened, When, Impact, Expectations set,
Consequences), each omitted when empty; the meta line with evidence types and
description, prior warnings, re-evaluation, signed, manager name and email,
`ref`, and filed date; and the footer that is either *Closed … by …* with a
**Reopen** link or a **Close case** button.

Move it as it is. Do not redesign the fact list, do not shorten the text, and do
not change how closing or reopening works — `onChanged` still fires after both.
Full narrative text stays **untruncated here**; this is where someone reads it.

Render it in a row beneath its action line, spanning the full width.

## Keep

- Oldest first, so the escalation reads in the order it happened.
- `caseState` from `@/app/lib/disciplinary` for every status decision. Do not
  re-derive it inline.
- `fmtDate` for every date. **No `new Date(...)` in either file.**
- No `useLoadAction` and no `useGlobalFilters` in `CaseFile.tsx` **or**
  `ActionDetail.tsx` — both stay prop-driven so Employee 360 can reuse them.

## Acceptance — observable outcomes

1. Exactly the two named files changed. Both under 15 KB.
2. Expanding an employee shows **one line per action** and no header strip.
3. The "what happened" text is truncated on that line and never wraps.
4. Expanding an action line reveals its full facts, meta and footer, with the
   narrative **not** truncated.
5. Only one action is open at a time.
6. **Juan Molina is the case to check** — three actions, expanding to three
   lines, in order 06-16 Attendance, 06-16 Calls, 06-23 First Written. Two share
   a `document_date` and an identical `submitted_at`, so that order proves the
   `id` tiebreak survived.
7. Close case and Reopen still work from inside an expanded action, and the
   table still refreshes afterwards.
8. Neither file contains `{ params:` or `new Date(`.
