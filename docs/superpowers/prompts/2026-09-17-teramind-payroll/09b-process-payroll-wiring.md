# 09b — Process Payroll, step 2: capture punches from Teramind (file upload stays as backup)

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…`. Never create a top-level folder named `src`.**

## Files that may change

- `src/app/pages/ProcessPayroll.tsx` — **only the ten edits listed below, nothing else**

No other file may be touched. Never edit `PayrollMaster.tsx`, `ActionRequired.tsx`,
`classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything under
`src/components/ui/`.

**The owner has explicitly asked for this change to `ProcessPayroll.tsx`.** It is the most
sensitive file in the app: it decides what people are paid. Make the ten edits exactly as
written. Do not reformat, reorder, rename, "tidy", extract, or fix anything else in the file, even
if it looks wrong. Do not add or remove any `cfgGet(` call — a test counts them (must stay 14).
Apart from the one guard line in edit 9, do not touch `handleMappingSave`; do not touch `runEngine`, the Monday pulls, the batching, `softDeleteStaleEntries`,
`upsertPeriod`, the re-run confirm, or the mid-day checkbox.

## What this does

Step 2 currently requires an uploaded Teramind file. After this change it shows the
`TeramindSourceCard` (already in the project) first, and the existing upload zone underneath as a
backup. Whichever source is used, the page ends up with the same `teramindRows` state it has
always had, so everything after step 2 is unchanged.

## The ten edits

**1. Import** — add after the `teramindParser` import line:

```ts
import { TeramindSourceCard, type ApiCapture } from '@/app/pages/process/TeramindSourceCard';
```

**2. State** — add directly under the line `const fileRef = useRef<HTMLInputElement>(null);`:

```ts
  // Punches captured from the Teramind API instead of an uploaded file.
  const [apiCapture, setApiCapture] = useState<ApiCapture | null>(null);
  const hasPunches = !!teramindFile || !!apiCapture;
```

**3. `handleFileChange`** — choosing a file replaces an API capture. Change its first two lines from

```ts
    const file = e.target.files?.[0] || null;
    setTeramindFile(file);
```

to

```ts
    const file = e.target.files?.[0] || null;
    setTeramindFile(file);
    if (file) { setApiCapture(null); setTeramindRows([]); }
```

(The file is parsed asynchronously a moment later; until then the page must not keep showing the
captured rows as if they came from the file.)

**4. `handleRun` guard** — change

```ts
    if (!periodName || !startDate || !endDate || !teramindFile) {
      setError('Complete all required fields: Period Name, Start Date, End Date, and Teramind file.');
```

to

```ts
    if (!periodName || !startDate || !endDate || !hasPunches || teramindRows.length === 0) {
      setError('Complete all required fields: Period Name, Start Date, End Date, and Teramind punches (capture them or upload a file).');
```

**5. Snapshot** — change

```ts
rawData: JSON.stringify(teramindRows.slice(0, 100)) });
```

(the `snapshotType: 'teramind'` line only) to

```ts
rawData: JSON.stringify(apiCapture ? { source: 'teramind_api', capture: apiCapture, sample: teramindRows.slice(0, 100) } : teramindRows.slice(0, 100)) });
```

**6. Two warning texts** — `Teramind file starts ${tmMin}` → `Teramind data starts ${tmMin}`, and
`Teramind file ends ${tmMax}` → `Teramind data ends ${tmMax}`. Text only.

**7. `formReady`** — change `teramindFile &&` to `hasPunches && teramindRows.length > 0 &&`.
(`formReady` is declared after `hasPunches`, so the order is fine.)

**8. Step 2 markup.**

a. `<StepCard number={2} … title="Teramind Export" complete={!!teramindFile}>` becomes
   `title="Teramind Punches" complete={hasPunches && teramindRows.length > 0}`. Keep the icon.

b. Directly after the hidden `<input ref={fileRef} …/>` line, insert:

```tsx
          <TeramindSourceCard
            startDate={startDate}
            endDate={endDate}
            disabled={isRunning || status === 'mapping' || status === 'warnings' || !!teramindFile}
            capture={apiCapture}
            onCaptured={(rows, info) => { setTeramindFile(null); setTeramindRows(rows); setApiCapture(info); }}
            onCleared={() => { setApiCapture(null); setTeramindRows([]); }}
          />
```

c. Wrap the existing `{!teramindFile ? ( …drop zone… ) : ( …green file box… )}` block — unchanged
   inside — so that it is rendered only when there is no API capture, under a small heading:

```tsx
          {!apiCapture && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Backup: Upload A File</p>
              {/* the existing {!teramindFile ? (…) : (…)} block goes here, unchanged */}
            </div>
          )}
```

   Leave the "Export pulled mid-day" checkbox block exactly where and as it is.

**9. `handleMappingSave` — refuse to run on cleared punches.** Its body starts

```ts
    setStatus('running');
    setError('');
    try {
```

Insert **above** `setStatus('running');`:

```ts
    if (teramindRows.length === 0) { setError('The Teramind punches were cleared — capture or upload them again.'); setStatus('idle'); return; }
```

**10. "Proceed Anyway" — same guard.** In the warnings panel, the button's `onClick` starts

```ts
                  onClick={() => {
                    if (stashedMonday) {
```

Insert between those two lines:

```ts
                    if (teramindRows.length === 0) { setError('The Teramind punches were cleared — capture or upload them again.'); setStatus('idle'); return; }
```

Why 8b, 9 and 10: while the name-mapping or warnings screen is showing, the page is not "running",
so step 2 is still clickable. Without these, clearing the capture there and pressing Proceed Anyway
would run the engine on zero punches and write a whole period of absences.

## Acceptance (check on /dev — do NOT click "Pull Monday Data & Run Engine")

1. Only `ProcessPayroll.tsx` changed, and only by the ten edits.
2. Step 2 shows the Capture card first and "Backup: Upload A File" under it.
3. With period dates filled in, **Capture From Teramind** turns step 2 green with employee / day /
   record counts, and the Run button becomes enabled. Changing a period date clears the capture.
4. Uploading a file still works exactly as before and clears any capture.
5. The file still contains exactly 14 `cfgGet(` fallbacks.
6. Hard-refresh `/dev` (Ctrl+Shift+R) before judging any of the above.
