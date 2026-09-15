# 11 — Close case: move the button to the top of the case viewer and make it obvious

## Files that may change

- `src/app/pages/disciplinary/ActionDetail.tsx`

No other file may be touched. Do not touch `CloseCaseDialog.tsx` or the
reopen logic.

## Why

Saul: the **Close case** button is small, outlined, and sits at the very bottom
of the expanded case, under all the facts — it is easy to miss. Put the
case's status and its action at the **top** of the viewer.

## The change

In `ActionDetail`'s returned JSX:

1. **Remove** the existing footer block (the `state === 'closed' ? (…) : (…)`
   ternary that sits after the meta line).
2. **Insert** the same ternary as the **first child** of the outer
   `<div className="bg-white border …">`, before the Facts block, with this markup:

   - **Closed**: keep the existing emerald bar exactly as it is today (text and
     the **Reopen** link), but use `border-b border-emerald-100` instead of
     `border-t`.
   - **Open**:
     ```tsx
     <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between gap-3 flex-wrap">
       <span className="text-[12px] font-medium text-rose-800">This case is open.</span>
       <Button
         onClick={() => setDialogOpen(true)}
         className="bg-[#BE123C] hover:bg-[#9F1239] text-white h-9 px-4 text-[13px] font-semibold shadow-sm"
       >
         <CheckCircle2 className="w-4 h-4 mr-1.5" />
         Close case
       </Button>
     </div>
     ```
3. Add `CheckCircle2` to the existing `lucide-react` import.

Nothing else moves. The Facts, meta line and `<CloseCaseDialog>` stay where they are.

## Acceptance

1. Lint clean.
2. Then confirm every identifier used in the file is imported, in particular
   `CheckCircle2`, `Button`, `Loader2`.

Do not build anything else.
