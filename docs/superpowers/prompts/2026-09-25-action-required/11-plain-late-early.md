# AR-11: Late and Early in plain dark text

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only this file may change:** `src/app/pages/action-required/ArRow.tsx`

No other file may be touched.

## Why (Saul)
"Early and Late times: no yellow or red colouring. Just black as the rest of the text."
The Late and Early numbers are currently bold red / bold yellow. They should look like the
other values in the row: normal weight, the row's dark text. An empty value stays the grey "—".

## Change
In `src/app/pages/action-required/ArRow.tsx`, replace exactly these two lines:

```tsx
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${late > 0 ? 'font-semibold text-status-red-ink' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(late) || '—'}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${early > 0 ? 'font-semibold text-status-yellow-ink' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(early) || '—'}</td>
```

with exactly these two lines:

```tsx
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${late > 0 ? 'text-slate-800' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(late) || '—'}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${early > 0 ? 'text-slate-800' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(early) || '—'}</td>
```

Nothing else in the file changes. Do not touch the Discount column (its red/yellow pill stays).

## Report
File size before and after, and confirm no other file changed.
