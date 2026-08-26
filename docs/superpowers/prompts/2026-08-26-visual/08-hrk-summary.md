# HRK Summary: give it a title, stop showing raw errors, use the brand colours

One file: **`src/app/pages/HrkSummary.tsx`**. Not a protected file.

This is the page the payroll consultant's file comes from — arguably the
highest-consequence screen in the product — and it is the least designed. It has
**no page title at all**, it shows raw JavaScript exceptions to the owner, and
its two main buttons use colours that appear nowhere else in the app.

## 1. Give the page a header, using the shared component

`src/app/components/PageHeader.tsx` exists and is used only by the PTO page. Use
it here. It is a default export:
`import PageHeader from '@/app/components/PageHeader';`

Restructure the outermost wrapper so the header sits at the top and the rest
keeps its horizontal padding. Currently it is:

```tsx
<div className="p-6 max-w-[1600px] mx-auto space-y-5">
```

Change to:

```tsx
<div className="max-w-[1600px] mx-auto pb-6">
  <PageHeader
    title="HRK Summary"
    subtitle="Payroll export for the HR consultant"
    actions={/* the existing button group, unchanged */}
  />
  <div className="px-6 space-y-5">
    {/* everything that was after the old header block */}
  </div>
</div>
```

- Move the **entire existing action group** — the period pill, Refresh, Undo,
  Save Edits and Export CSV — into `PageHeader`'s `actions` prop exactly as it
  is. Do not change any of their handlers or conditions.
- Delete the old header `<div>` and the `<p>Payroll export for HR consultant</p>`
  it contained; `PageHeader` now carries that text as its subtitle.
- Everything else — alerts, stats, the table `Card` — goes inside the new
  `px-6 space-y-5` wrapper in the same order.

## 2. Stop showing raw JavaScript to the user

Two places leak an exception:

- Line ~157: `setExportError('Export failed to save. Please try again. ' + String(e));`
- Line ~265: `Failed to load. {String(error)}`

Replace both with plain language that names the action and what to do, and drop
the exception text entirely:

- Export failure → `Couldn't save the export — saveHrkExport. Nothing was
  downloaded and your edits are still here. Try again, and if it keeps failing,
  check the Period Log.`
- Load failure → `Couldn't load the summary — loadHrkSummary. Try Refresh.`

Keep `console.error(e)` in the export catch block so the detail is still
available in the console for diagnosis. That is where an exception belongs, not
in front of the owner.

## 3. Use the brand colours

- The **Export CSV** button is `bg-indigo-600 hover:bg-indigo-700`. Change it to
  the default primary button — remove the colour classes and let `Button` use its
  own `default` variant, which is GAF navy.
- The **Save Edits** button is `bg-emerald-600 hover:bg-emerald-700`. Change it to
  `bg-secondary hover:bg-secondary/90`, the GAF teal, which is the brand's
  positive colour.

Indigo and emerald appear nowhere else in this app.

## 4. Make the figures read as data

- Add `tabular-nums` to the table's className (line ~272), so it becomes
  `w-full text-xs tabular-nums`.
- In `StatCard` (line ~439), add `tabular-nums tracking-tight` to the value
  element and give the four cards the same shape the Dashboard and Attendance
  now use: **Total Discount Hours is the lead** — add
  `border-primary shadow-[inset_3px_0_0_var(--primary)]` to that one card via a
  new optional `lead` prop, defaulting to false. Keep the existing `highlight`
  prop and its amber treatment for Incapacidad and PTO exactly as it is.

## Do not touch

- **No other file.** Not `PageHeader.tsx`, not `index.css`, not an action.
- Do not change any query, any calculation, `buildCsv`, `downloadCsv`, the
  override/edit/undo/save logic, the review-flag detection, or the CSV contents.
  **No number and no exported value may change.**
- Do not change the table's columns, their order, or the `Th`/`Td` helpers'
  behaviour beyond what is listed.

## Acceptance criteria

- The page shows a real title, **HRK Summary**, with the subtitle beneath it, and
  the Refresh / Export buttons sit on that header row.
- Total Discount Hours for `Q2-Aug-2026` still reads **182.2h**, and the employee
  count still reads 45.
- Export CSV is navy; Save Edits, when it appears, is teal.
- No raw exception text can appear on the page.
- The table still lists every employee with the same columns and values.
- No console errors.

Then confirm every identifier used in the file is imported.
