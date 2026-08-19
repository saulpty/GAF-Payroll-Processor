One timezone fix. Change only `src/app/pages/pto/FloatingHolidaysTab.tsx`. No other file may change.

## The bug

Two places compute "today" as `new Date().toISOString().slice(0, 10)`:

```ts
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr: string): number {
  const t = new Date().toISOString().slice(0, 10);
  ...
}
```

`toISOString()` returns **UTC**. Panama is UTC−5 all year. So from 19:00 local time onwards, both of these return *tomorrow's* date. Floating-holiday eligibility is a comparison against today, so every evening an employee whose 90th day is tomorrow would be shown as already eligible. The comment above `todayStr` claims it "avoids any Date construction", which is not what the code does — it constructs a Date and then converts it to a different timezone.

This is the same defect class as the roughly ten timezone migrations in this project's history. See `src/AGENTS.md`, Timezone rules.

## The fix

This codebase already has the correct helper. Use it:

```ts
import { toLocalYMD } from '@/app/lib/classificationEngine';
```

`toLocalYMD(d)` builds the string from `getFullYear()`, `getMonth()` and `getDate()`, which are the machine's local calendar day — no timezone conversion.

Replace both occurrences:

```ts
function todayStr(): string {
  return toLocalYMD(new Date());
}
```

and inside `daysUntil`, replace `const t = new Date().toISOString().slice(0, 10);` with `const t = toLocalYMD(new Date());`.

Fix the misleading comment above `todayStr` while you are there — say that it returns the local calendar day, not UTC.

Leave `const CUR_YEAR = new Date().getFullYear();` exactly as it is. `getFullYear()` is already local, so it is correct.

Do not change `fhEligibleDate` or `fhRemaining`, and do not touch `ptoAccrual.ts` — the arithmetic there is string-based and already correct.

Acceptance: `FloatingHolidaysTab.tsx` contains no `toISOString()`; it imports `toLocalYMD` from `@/app/lib/classificationEngine` and uses it for both "today" values; `CUR_YEAR` is unchanged; the tab still renders with the same columns.
