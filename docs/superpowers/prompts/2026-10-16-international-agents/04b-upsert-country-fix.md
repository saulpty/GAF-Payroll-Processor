# One-line correction in upsertEmployee (country on update)

**Copy the edit exactly, character for character. Change nothing else.**

The last prompt asked for this line in the `DO UPDATE SET` list of `src/actions/upsertEmployee.ts`:

```sql
        country                 = COALESCE(NULLIF({{params.country}}, ''), employees.country);
```

It was written with `EXCLUDED.country` instead of `{{params.country}}`. That is wrong here:
`EXCLUDED.country` is never empty, because the insert half turns a missing country into
`'Panama'`. So saving an international employee from Admin → Roster (which sends no country)
would silently change them to Panama and put them into payroll.

**Only this file may change:** `src/actions/upsertEmployee.ts`. **No other file may be touched.**
Never touch `ProcessPayroll.tsx`, `classificationEngine.ts` or anything in `src/components/ui/`.

## The edit

Replace the line

```sql
        country                 = COALESCE(NULLIF(EXCLUDED.country, ''), employees.country);
```

with

```sql
        country                 = COALESCE(NULLIF({{params.country}}, ''), employees.country);
```

Nothing else in the file changes. Reply with the diff.
