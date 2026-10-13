# Phone view, rows 6: one disciplinary action

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

After the previous prompt, a phone opens an employee's case file as a sheet and an action opens
inside it. The action itself is still drawn for a computer: its buttons are 32 px tall, "Reopen" is
a small underlined word although it changes the case, "Close Case" is rose-red like a delete
button, the small print is 10 and 11 px, and the edit form puts its boxes two to a line. This
prompt fixes those on a phone and nothing else.

**Every edit below only adds classes that start with `phone:` to a class string that already
exists.** No line is added, removed or moved; no import, no hook, no condition, no new element.
Who may see or press what does not change: every `isDisciplinaryAdmin` condition stays exactly
where and as it is.

**Only these files may change.** Four edited: `src/app/pages/disciplinary/ActionDetail.tsx`,
`src/app/pages/disciplinary/ActionPdfBar.tsx`, `src/app/pages/disciplinary/EditActionForm.tsx`,
`src/app/pages/disciplinary/EditResultPanel.tsx`. **No other file may be touched.** No migration,
no action file.

Rules:
- Only these files may change: the four listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Already in the app from earlier prompts. **Use it; do not create, edit or redefine it:**
`src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies only
on a phone-sized screen. A class written `phone:[&>button]:h-11` applies `h-11`, on a phone only,
to the buttons directly inside the element that carries it. Do not replace any `phone:` class
below with `sm:`, `md:` or `max-md:`, and do not "simplify" one by moving it onto another element.

`CloseCaseDialog.tsx` and `DeleteActionDialog.tsx` are **not** edited. They must stay byte for
byte as they are.

## 1. `src/app/pages/disciplinary/ActionDetail.tsx`: eleven class-string edits, nothing else

The same `<div className="flex items-center gap-2 shrink-0">` and the same Delete button appear
more than once in this file, so several edits below quote two or more lines to say which one is
meant. Change only the lines shown.

**1a.** In `Fact` (the small heading above each answer), replace

```tsx
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
```

with

```tsx
      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1 phone:text-[12px] phone:text-slate-500">
```

**1b.** In `Fact` (the answer), replace

```tsx
      <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{value}</p>
```

with

```tsx
      <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap phone:text-[14px] phone:break-words">{value}</p>
```

**1c.** The grey bar of a deleted action. Replace

```tsx
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-slate-700">
```

with

```tsx
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap phone:flex-col phone:items-stretch">
          <span className="text-[12px] text-slate-700 phone:text-[13px]">
```

**1d.** The Restore button in that bar. Replace

```tsx
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleRestore} disabled={restoring} className="h-8 text-[12px]">
```

with

```tsx
            <div className="flex items-center gap-2 shrink-0 phone:w-full">
              <Button variant="outline" size="sm" onClick={handleRestore} disabled={restoring} className="h-8 text-[12px] phone:h-11 phone:flex-1 phone:text-[13px]">
```

**1e.** The green bar of a closed case. Replace

```tsx
        <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] text-emerald-700">
```

with

```tsx
        <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between gap-3 flex-wrap phone:flex-col phone:items-stretch">
          <span className="text-[12px] text-emerald-700 phone:text-[13px]">
```

**1f.** Reopen. On a computer it stays the small underlined word it is today. On a phone the
added classes draw the same `<button>` as a bordered button 44 px tall. Replace

```tsx
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReopen}
              disabled={reopening}
              className="text-[12px] text-emerald-700 underline underline-offset-2 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded disabled:opacity-50"
```

with

```tsx
          <div className="flex items-center gap-2 shrink-0 phone:w-full">
            <button
              type="button"
              onClick={handleReopen}
              disabled={reopening}
              className="text-[12px] text-emerald-700 underline underline-offset-2 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded disabled:opacity-50 phone:inline-flex phone:h-11 phone:flex-1 phone:items-center phone:justify-center phone:rounded-md phone:border phone:border-emerald-300 phone:bg-white phone:px-4 phone:text-[13px] phone:font-medium phone:no-underline"
```

**1g.** The Delete button of a closed case (the one right after the `</button>` that ends
Reopen). Replace

```tsx
            </button>
            {isDisciplinaryAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8 text-[12px] text-red-700 border-red-200 hover:bg-red-50">
```

with

```tsx
            </button>
            {isDisciplinaryAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8 text-[12px] text-red-700 border-red-200 hover:bg-red-50 phone:h-11 phone:flex-1 phone:text-[13px]">
```

**1h.** The rose bar of an open case. Replace

```tsx
        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[12px] font-medium text-rose-800">This Case Is Open</span>
```

with

```tsx
        <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between gap-3 flex-wrap phone:flex-col phone:items-stretch">
          <span className="text-[12px] font-medium text-rose-800 phone:text-[13px]">This Case Is Open</span>
```

**1i.** Close Case. On a computer it keeps its rose colour. On a phone it is an ordinary navy
button: closing a case is not a destructive action, and only Delete is red. Replace

```tsx
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-[#BE123C] hover:bg-[#9F1239] text-white h-9 px-4 text-[13px] font-semibold shadow-sm"
```

with

```tsx
          <div className="flex items-center gap-2 shrink-0 phone:w-full">
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-[#BE123C] hover:bg-[#9F1239] text-white h-9 px-4 text-[13px] font-semibold shadow-sm phone:h-11 phone:flex-1 phone:bg-primary phone:hover:bg-primary"
```

**1j.** The Delete button of an open case (the one right after the `</Button>` that ends Close
Case). Replace

```tsx
            </Button>
            {isDisciplinaryAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8 text-[12px] text-red-700 border-red-200 hover:bg-red-50">
```

with

```tsx
            </Button>
            {isDisciplinaryAdmin && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="h-8 text-[12px] text-red-700 border-red-200 hover:bg-red-50 phone:h-11 phone:flex-1 phone:text-[13px]">
```

**1k.** The Edit button, and the small line under the answers. Replace

```tsx
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-8 text-[12px]">
```

with

```tsx
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-8 text-[12px] phone:h-11 phone:px-4 phone:text-[13px]">
```

and replace

```tsx
            <div className="px-4 py-2.5 border-t border-dashed border-slate-200 text-[11px] text-slate-400 leading-relaxed">
```

with

```tsx
            <div className="px-4 py-2.5 border-t border-dashed border-slate-200 text-[11px] text-slate-400 leading-relaxed phone:text-[13px] phone:text-slate-500 phone:break-words">
```

Everything else in this file stays exactly as it is: the three `{isDisciplinaryAdmin && (`
conditions and the `{isDisciplinaryAdmin && !action.deleted_at && !editing && (` condition,
`handleReopen`, `handleRestore`, the two dialogs at the bottom, the `savedUnreloaded` lines.

## 2. `src/app/pages/disciplinary/ActionPdfBar.tsx`: four class-string edits, nothing else

**2a.** The Download PDF button. Replace

```tsx
          className="h-8 text-[12px]"
        >
          {busy === 'current'
```

with

```tsx
          className="h-8 text-[12px] phone:h-11 phone:px-4 phone:text-[13px]"
        >
          {busy === 'current'
```

**2b.** The Download original PDF button. Replace

```tsx
            className="h-8 text-[12px]"
          >
            {busy === 'original'
```

with

```tsx
            className="h-8 text-[12px] phone:h-11 phone:px-4 phone:text-[13px]"
          >
            {busy === 'original'
```

**2c.** Replace

```tsx
        {edited && <span className="text-[11px] text-slate-500">{edited}</span>}
```

with

```tsx
        {edited && <span className="text-[11px] text-slate-500 phone:text-[12px]">{edited}</span>}
```

**2d.** Replace

```tsx
        {error && <span className="text-[11px] text-red-600">{error}</span>}
```

with

```tsx
        {error && <span className="text-[11px] text-red-600 phone:text-[12px]">{error}</span>}
```

## 3. `src/app/pages/disciplinary/EditActionForm.tsx`: five class-string edits, nothing else

**3a.** The seven boxes at the top go one to a line on a phone, each 44 px tall. Replace

```tsx
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
```

with

```tsx
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 phone:grid-cols-1 phone:[&_input]:h-11 phone:[&_select]:h-11">
```

**3b.** The evidence tick boxes go one to a line. Replace

```tsx
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
```

with

```tsx
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 phone:flex-col phone:flex-nowrap phone:gap-y-0">
```

**3c.** Each tick box gets a 44 px line to tap, and a bigger box. Replace

```tsx
            <label key={opt} className="inline-flex items-center gap-1.5 text-[13px] text-slate-700">
```

with

```tsx
            <label key={opt} className="inline-flex items-center gap-1.5 text-[13px] text-slate-700 phone:flex phone:min-h-11 phone:gap-3 phone:text-[14px] phone:[&>input]:h-5 phone:[&>input]:w-5 phone:[&>input]:shrink-0">
```

**3d.** Cancel and Save go full width, Save on top. Replace

```tsx
      <div className="flex items-center justify-end gap-2">
```

with

```tsx
      <div className="flex items-center justify-end gap-2 phone:flex-col-reverse phone:items-stretch phone:[&>button]:h-11 phone:[&>button]:text-[14px]">
```

**3e.** Save is navy on a phone, like Close Case (only Delete is red). Replace

```tsx
        <Button size="sm" onClick={() => save(v)} disabled={saving || invalid !== null} className="bg-[#BE123C] hover:bg-[#9F1239] text-white">
```

with

```tsx
        <Button size="sm" onClick={() => save(v)} disabled={saving || invalid !== null} className="bg-[#BE123C] hover:bg-[#9F1239] text-white phone:bg-primary phone:hover:bg-primary">
```

The constant `SELECT`, `initialValues`, `problem`, `toggleEvidence` and every `<Field>` stay
exactly as they are.

## 4. `src/app/pages/disciplinary/EditResultPanel.tsx`: one class-string edit, nothing else

The three buttons shown after a save (Download updated PDF, Retry email, Done). Replace

```tsx
      <div className="flex items-center gap-2 mt-3 flex-wrap">
```

with

```tsx
      <div className="flex items-center gap-2 mt-3 flex-wrap phone:[&>button]:h-11 phone:[&>button]:px-4 phone:[&>button]:text-[13px]">
```

## Acceptance — visible facts

On a phone-sized screen (375 × 667), signed in as a disciplinary admin, on Disciplinary with an
employee's case file open:
1. Open an **open** action. The rose bar reads "This Case Is Open" on its own line; under it
   Close Case and Delete sit side by side, each 44 px tall, sharing the width. **Close Case is
   navy with white text. Delete is the only red one.**
2. Tap Close Case, then **Cancel**. Tap Delete, then **Cancel**. Both pop-ups open and close;
   nothing is saved.
3. Open a **closed** action. The green bar reads "Closed … by …" on its own line; under it
   **Reopen is a bordered button 44 px tall** (not an underlined word) beside Delete. **Do not tap
   Reopen** unless the case is one you may reopen: it saves at once.
4. Download PDF is 44 px tall and downloads the PDF. Edit, at the right, is 44 px tall.
5. The six answers: headings 12 px, text 14 px, long words wrap. The small last line (Evidence …
   Ref) is 13 px and readable.
6. Tap Edit. Document date, Re-evaluation date, Role, Branch, Warning level, Final outcome and
   Situation type are **one to a line**, each 44 px tall. The evidence tick boxes are one to a
   line with a 44 px line to tap. At the bottom "Save and email" (navy) is full width with Cancel
   full width under it. Tap **Cancel**; save nothing.
7. With View As a manager: no Edit, no Delete, no Restore anywhere; Close Case and Reopen are
   there, as on a computer.
8. No console errors.

On a computer nothing changes (1440 wide, mouse):
9. An open action: the same rose Close Case button and small red-outlined Delete at the right of
   the bar. A closed action: "Reopen" is the same small underlined green word. Download PDF and
   Edit are the same 32 px buttons.
10. The edit form: four boxes to a line, tick boxes in a wrapping line, Cancel and a rose "Save
    and email" at the bottom right. Exactly as before.

When done, reply with a one-line summary per file.
