# Phone view prompts: stages 2 and 3 (rows instead of tables)

Design: `docs/superpowers/specs/2026-10-12-mobile-view-design.md` ("The pages", "States").
Plan: `docs/superpowers/plans/2026-10-12-mobile-view.md` (M6–M14). Look: `docs/DESIGN-SYSTEM.md`, "Phone".
Stage 1 (`../2026-10-13-mobile/`, prompts 00–06) is live since 2026-10-13.

| File | Plan step | Page |
|---|---|---|
| `08-today-rows.md` | M6 | `MobileRow` + Attendance → Today |
| `09-panel-sheet.md` | M7 | Employee panel as a sheet (after 08) |
| `10-pto-rows.md` | M8 | PTO Tracker (after 08) |
| `11-contracts-rows.md` | M9 | Contracts (after 08) |
| `12-disciplinary-rows.md` | M10 | Disciplinary list and case file (after 08) |
| `13-disciplinary-action.md` | M11 | One disciplinary action (after 12) |
| `14-list-rows.md` | M12 | Attendance → List (after 09) |
| `15-activity-rows.md` | M13 | Attendance → Activity (after 09) |
| `16-reports-tiles.md` | M14 | Attendance → Reports (after 08) |

Each prompt's test waits in `tests/` inside this folder until the prompt is sent, then moves to the
repository's `tests/`.

## What already exists (stage 1) — use it, never redefine it

- `useIsPhone()` from `@/app/lib/useIsPhone` (named export). True on a phone-sized screen.
- The Tailwind variant `phone:` (same media query). **`max-*:` and `min-*:` variants do not work in
  this app** (a raw screen switches them off): never use them. Do not use `sm:` / `md:` for the
  phone switch.
- `MobileSheet` from `@/app/components/mobile/MobileSheet` (default export), props
  `{ open, onClose, title, subtitle?, size?: 'partial' | 'full', keepMounted?, children }`. Its body
  has no padding of its own.
- `src/index.css`: on touch screens text boxes are already 16 px; `.tap` gives a 44 × 44 minimum
  hit area.
- On a phone the page scroller is `<main>`; a 56 px section bar sits under it. Sheets and dialogs
  sit above everything.

## The rule for every page

The page calls `useIsPhone()` **once** and renders **either** the rows **or** the table, never both
(so no row's hooks run twice). The rows are built from the **same data the table already has**:
no new loader, no action file, no SQL. Sorting and filtering stay where they are and feed both.
On a computer nothing changes: the table branch is the existing code, untouched.

## `MobileRow` (created by prompt 08; every later prompt relies on this exact file)

`src/app/components/mobile/MobileRow.tsx` — the whole file:

```tsx
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  /** Line 1, left: the name. Wraps onto a second line; never cut off. */
  title: ReactNode;
  /** Small line under the title (role, position). */
  sub?: ReactNode;
  /** Line 1, pinned right: one status pill or one headline number. */
  right?: ReactNode;
  /** Line 2: up to three facts. */
  facts?: ReactNode;
  /** Whole-row wash for a flagged row, as on the computer. */
  tone?: 'none' | 'green' | 'yellow' | 'red';
  /** Day off, inactive, closed: muted text (never see-through). */
  muted?: boolean;
  /** down / up = opens in place (reading only). right = opens a sheet. */
  chevron?: 'none' | 'down' | 'up' | 'right';
  /** When given, the row is a real button. */
  onClick?: () => void;
  /** For rows that open in place. */
  expanded?: boolean;
  /** Name for screen readers when the title is not plain text. */
  label?: string;
  /** The opened-in-place detail, shown under the row. */
  children?: ReactNode;
};

const TONE = {
  none: 'bg-white',
  green: 'bg-status-green-tint',
  yellow: 'bg-status-yellow-tint',
  red: 'bg-status-red-tint',
} as const;

const CHEVRON = { down: ChevronDown, up: ChevronUp, right: ChevronRight } as const;

/** One row of a phone list: flat, full width, a hairline under it. See DESIGN.md, "Phone". */
export default function MobileRow({
  title, sub, right, facts, tone = 'none', muted = false, chevron = 'none', onClick, expanded, label, children,
}: Props) {
  const Icon = chevron === 'none' ? null : CHEVRON[chevron];
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={cn('block text-[14px] font-semibold leading-5 break-words', muted ? 'text-slate-500' : 'text-slate-900')}>
            {title}
          </span>
          {sub && <span className="block text-[12px] leading-4 text-slate-500 break-words">{sub}</span>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {right}
          {Icon && <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />}
        </span>
      </span>
      {facts && (
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-slate-500 tabular-nums">
          {facts}
        </span>
      )}
    </>
  );
  const box = cn('block w-full min-h-[60px] px-4 py-3 text-left', TONE[tone]);
  return (
    <div className="border-b border-slate-200">
      {onClick ? (
        <button
          type="button" onClick={onClick} aria-expanded={expanded} aria-label={label}
          className={cn(box, 'active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warm-ring')}
        >
          {body}
        </button>
      ) : (
        <div className={box}>{body}</div>
      )}
      {children}
    </div>
  );
}
```

Notes for users of `MobileRow`:
- Everything inside the button is a `<span>` (a button may not contain a `<div>`), so pass spans or
  text, pills and icons as `title` / `sub` / `right` / `facts`. Do not pass a `<button>` or a link
  inside a row that has `onClick`: put actions in `children` (the opened detail) or in a sheet.
- A list of rows is wrapped by the page in `<div className="bg-white border-t border-slate-200">`.
- Opened-in-place detail (`children`) uses `bg-slate-50 px-4 py-3 text-[13px]`.
- Loading: three to five `<div className="h-[60px] border-b border-slate-200 bg-white animate-pulse" />`
  placeholders when the page has no rows yet. Nothing found: one centred line that names the active
  filter. Error: the page's existing message and Retry.
- Type: nothing below 12 px; names 14 px semibold; facts 13 px; pills 12 px.
- The existing status pills, chips and cells of each page are reused as they are (imported, not
  copied) wherever they are plain inline elements.

## House style

Same as `../2026-10-13-mobile/README.md`, "House style", including the standing rules word for
word, with this line added to them: "Follow the Phone section of `src/DESIGN.md`."
Lesson from stage 1: **small exact edits come back byte-identical; whole-file rewrites of existing
files get paraphrased.** New files are given whole. Existing files get the smallest "replace X with
Y" edits that work, each anchor unique in its file.
