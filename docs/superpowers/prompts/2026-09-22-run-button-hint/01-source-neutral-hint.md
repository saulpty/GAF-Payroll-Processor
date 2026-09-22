# 01 — One line: the Run button's hint still says "upload the Teramind file"

**Only this file may change, and only the one line named below. No other file may be touched.**

- `src/app/pages/ProcessPayroll.tsx`

Saul asked for this specific change, which is why a payroll file is in scope. It is a **wording fix
only**. Do not touch any logic, any handler, any `cfgGet` call or its fallback, the step cards, the
capture card, the upload zone, or anything else in this 57 KB file. Do not reformat. Do not create
files.

## Why

Punches can now come from **Capture From Teramind** or from the backup upload, but the hint under the
disabled Run button still tells the user to upload a file — wording left over from when uploading was
the only way. Tim reads this line every time the button is greyed out.

The error message on the same guard (line 321) was already made source-neutral:

```ts
      setError('Complete all required fields: Period Name, Start Date, End Date, and Teramind punches (capture them or upload a file).');
```

The hint should match it.

## The change

At **line 840**, inside the `{!formReady && (…)}` block under the Run button, replace:

```tsx
                Complete Period Name, dates, and upload the Teramind file to continue.
```

with:

```tsx
                Complete Period Name, dates, and Teramind punches (capture them or upload a file) to continue.
```

That is the entire change: one line, text only. The surrounding `<p className="text-xs text-center
text-muted-foreground mt-2">` and the `{!formReady && (` condition stay exactly as they are.

## How I will check it

- Process Payroll with an empty form: the greyed Run button's hint reads
  "Complete Period Name, dates, and Teramind punches (capture them or upload a file) to continue."
- The button still enables after a capture, and still enables after a backup file upload.
- `git status --short` shows `ProcessPayroll.tsx` and nothing else; the diff is one line.
- `lessonGuards.test.ts` L4 still passes — the count of `cfgGet` fallbacks in this file is unchanged
  at 14.
