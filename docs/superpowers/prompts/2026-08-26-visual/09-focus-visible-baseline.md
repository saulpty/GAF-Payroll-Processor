# Every interactive element needs a visible focus ring

One file: **`src/index.css`**. No component may be touched.

## The problem

A mechanical count found focus styling on **13 of 136 interactive elements —
under 10%**. The rest give a keyboard user no indication of where they are. That
includes the native `<select>` and `<input>` elements that make up the payroll
grids, which is most of the app's interaction surface.

The design brief this app already follows says *"visible `ring-2
ring-primary/30` on every interactive element."* It was applied to the PTO page
and nowhere else.

Editing a hundred elements is the wrong fix. One base rule covers all of them.

## The change

Add a `@layer base` block to `src/index.css`, after the `:root` block and before
the `@keyframes` declarations:

```css
@layer base {
  /* Keyboard focus is visible everywhere by default. :where() keeps this at zero
     specificity, so any component's own focus- classes still win. :focus-visible
     means mouse clicks do not draw it — only keyboard and assistive navigation. */
  :where(
    button,
    [role="button"],
    a[href],
    input,
    select,
    textarea,
    summary,
    [tabindex]:not([tabindex="-1"])
  ):focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
    border-radius: calc(var(--radius) - 4px);
  }
}
```

Three properties of this that matter, and why it is written this way:

- **`:where()` gives it specificity 0.** Anything a component already declares —
  the PTO page's `ring-2 ring-primary/30`, a shadcn variant's focus style —
  overrides it. This is a floor, not a ceiling.
- **`:focus-visible`, not `:focus`.** A mouse click will not draw a ring; only
  keyboard navigation and assistive technology will. That is why this can be
  applied globally without changing how the app looks in normal use.
- **`outline`, not `box-shadow`.** Outlines are not clipped by `overflow: hidden`,
  which matters here because the payroll grids scroll inside clipped containers,
  and a `box-shadow` ring on a cell would be invisible.

## Do not touch

- **No other file.** No component, no page, no `tailwind.config.js`.
- Do not remove or alter any existing token, keyframe, the `.no-scrollbar`
  utility, or the `.shadow-card` utility.
- Do not add a `:focus` rule, only `:focus-visible`.
- Do not change any existing `focus:` or `focus-visible:` class in any component.

## Acceptance criteria

- **Nothing changes visually when clicking with a mouse.** This is the important
  one: pressing a button or opening a dropdown must look exactly as it does now.
- Pressing **Tab** from the top of any page moves focus through the controls and
  each focused control shows a navy outline — check the top navigation, the
  FilterBar, and a row of dropdowns on Payroll Master.
- On Payroll Master, tabbing into a cell's `<select>` shows the ring and it is
  **not clipped** by the scrolling container.
- The PTO page's existing focus rings are unchanged, because component styles
  still win.
- Every page still loads with no console errors.

Then confirm every identifier used in the file is imported.
