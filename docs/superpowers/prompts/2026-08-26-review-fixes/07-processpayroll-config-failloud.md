# ProcessPayroll must say so when a Monday board id is missing from config

**`src/app/pages/ProcessPayroll.tsx` is a protected file.** Saul asked for this
change directly. Change nothing except what is written below.

## The defect

Lines 210-213 and 220-230 read every Monday board and column id through:

```ts
const cfgGet = (k: string, fallback: string) => cfgRows.find(r => r.key === k)?.value ?? fallback;
```

with a hardcoded id as the fallback — 14 of them. If a `classification_config`
row is missing or renamed, the run **silently uses an id typed into the code
months ago**. It could pull from the wrong board, or an empty one, and simply
show blank data with no error.

That is the same shape as the manager-column incident: valid-but-wrong id, no
error, plausible-looking output. The Directory sync deliberately does the
opposite — it has no fallback and shows a red banner — and this page, which
actually drives payroll classification, should not be the lenient one.

## The change

**Warn loudly; do not block the run.** A missing config row must be impossible to
miss, but it must still be possible to process payroll — stopping a run outright
would be a worse failure than a visible warning.

1. **Record which keys fell back.** Change `cfgGet` so that when the lookup misses
   and the fallback is used, it records that key. Collect the names in a
   `Set<string>` or array declared alongside `cfgRows`. Do not change its return
   value or signature beyond what this requires, and do not change any call site
   — all 14 stay exactly as they are.

   Note that `parseMondayItems` (line 215) runs during a payroll run, so the
   column-id keys are only recorded once that function executes. The three board
   keys at 211-213 are read on render. Both should feed the same collection.

2. **Show a warning in the UI.** Directly above the
   `Pull Monday Data & Run Engine` button, render a banner **only when at least
   one key fell back**. Match the red-banner style already used in this file at
   line 736 — `flex items-start gap-2 p-3 bg-red-50 border border-red-200
   rounded-lg text-sm text-red-700`, with the `AlertTriangle` icon that is
   already imported at line 9.

   Wording: `Using built-in Monday IDs for N setting(s) missing from Rules & Config.`
   followed by a quieter second line:
   `The run may read the wrong board. Add the missing keys in Admin → Rules & Config.`

3. **Tooltip with the detail.** The banner carries a `title` attribute listing the
   missing key names, one per line, so hovering shows exactly which are absent —
   e.g. `title={`Missing keys:\n${[...missingCfgKeys].join('\n')}`}`. Keep the
   banner itself short; the key names belong in the tooltip, not the banner body.

4. Also push one entry into the existing `warnings` array during a run, at
   `level: 'warn'`, with the same sentence, so it appears in the run log
   alongside the other data-quality warnings.

## Do not touch

- **Do not remove the fallback values.** They stay as they are; this change is
  about visibility, not behaviour.
- Do not change any of the 14 `cfgGet(...)` call sites.
- Do not change the classification logic, the run sequence, the Teramind upload,
  the period fields, the employee exclusion list, or any other warning.
- Do not change `classificationEngine.ts` or any other file. **Only
  `src/app/pages/ProcessPayroll.tsx` may be modified.**
- Do not reformat the file. The diff should be confined to the `cfgGet`
  definition, the new banner block, and the one added `warnings.push`.

## Acceptance criteria

- With config intact — which is the case today, all 29 Monday keys were seeded by
  migration `83c7582` — **no banner appears at all**. The Process page must look
  exactly as it does now. This is the important one: a false alarm here would be
  worse than the bug.
- The page still loads, Recent Periods still renders, and the run button still
  enables once Period Name, dates and a Teramind file are present.
- Do not run a payroll to test this. Loading the page is sufficient.

Then confirm every identifier used in the file is imported.
