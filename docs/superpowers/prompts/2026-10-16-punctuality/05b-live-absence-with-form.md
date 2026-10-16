# Attendance List: an absence on a day payroll has not processed counts as reported when a form is on file

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else.**

**Only this file may change:** `src/app/lib/liveListRows.ts`. **No other file may be touched.**

## Why (found 2026-10-16, checking prompt 05 on /dev)

After 05 the List's late days match Reports exactly (221 reported · 241 not, Sep 1 – Oct 15), but
absences read 1 reported · 9 not where Reports says 2 · 8. The one left is Jennette Torrano, Thu
Oct 15: a day payroll has not processed yet, with a Tardiness form on file. Those days are built by
`reportRowToList`, which turns every absence into "Absent - Unexplained" with `filed_gaf: false`,
even when the report found a form (`absent_reported_on_time` / `absent_reported_late`).

## 1. `src/app/lib/liveListRows.ts` — one edit, nothing else

Replace

```ts
    default:   // unexplained_absence, absent_reported_* — the List only knows unexplained
      return { ...base, status: 'Absent - Unexplained', bucket: 'absent' };
```

with

```ts
    default:   // unexplained_absence, absent_reported_* — one status; a form on file sets filed_gaf
      return { ...base, status: 'Absent - Unexplained', bucket: 'absent', filed_gaf: r.verdict !== 'unexplained_absence' };
```

## Acceptance

Attendance → List, Dates 09/01/2026 → 10/15/2026: Absent Days reads **2 Reported · 8 Not**, the
same as Reports. Nothing else changes.
