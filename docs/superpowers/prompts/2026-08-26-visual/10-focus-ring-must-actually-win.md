# Correction: the focus ring is declared but never drawn

One file: **`src/index.css`**. The rule added in the previous change does not
work. Measured on the live Payroll Master page, with a time input focused:

| property | computed | expected |
|---|---|---|
| `outline-offset` | **`2px`** | `2px` |
| `outline-style` | **`none`** | `solid` |
| `outline-width` | `3px` | `2px` |
| `outline-color` | `rgb(0, 0, 0)` | `rgb(27, 58, 107)` |

`:focus-visible` matched correctly, and **`outline-offset` came through**, which
proves the rule is in the stylesheet and is matching. Only the `outline`
shorthand is losing.

## Why

Two things are working against it:

1. **Cascade layers.** The rule sits in `@layer base`. In CSS, *any unlayered
   rule beats any layered rule*, whatever its specificity. UI Bakery's own theme
   stylesheet is unlayered, so an unlayered `outline: none` on focus wins against
   our layered rule no matter what we do inside the layer.
2. **`:where()` gives specificity 0**, so even unlayered it would lose to almost
   anything.

`outline-offset` survived only because nothing else declares it.

## The change

Replace the whole `@layer base { … }` block that was just added with an
**unlayered** rule using real selectors and explicit longhands:

```css
/* Keyboard focus must be visible on every control. This is deliberately
   unlayered and marked important: UI Bakery's own theme sets `outline: none`
   from an unlayered rule, and an unlayered rule beats anything inside @layer
   regardless of specificity. Components style focus with ring-* utilities,
   which are box-shadow, so nothing here is overridden by this.
   :focus-visible means a mouse click never draws it — keyboard only. */
button:focus-visible,
[role="button"]:focus-visible,
a[href]:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible,
[tabindex]:not([tabindex="-1"]):focus-visible {
  outline-style: solid !important;
  outline-width: 2px !important;
  outline-color: var(--primary) !important;
  outline-offset: 2px;
}
```

Place it at the same position the `@layer base` block occupies now — after the
`:root` block, before the `@keyframes` declarations.

Notes on the choices, so they are not "improved" later:

- **Unlayered on purpose.** Do not wrap it in `@layer base` or any other layer.
- **`!important` on purpose.** This is the one case where it is the right tool:
  an accessibility floor that a vendor reset would otherwise silently remove. It
  is scoped to three outline properties and nothing else.
- **Longhands, not the `outline` shorthand**, so `outline-offset` is not reset.
- **`:focus-visible` only.** Never add a `:focus` variant — that would draw rings
  on mouse clicks.

## Do not touch

- **No other file.** No component, no page, no `tailwind.config.js`.
- Do not remove or alter any token, keyframe, the `.no-scrollbar` utility or the
  `.shadow-card` utility.
- Do not add `!important` to anything else in this file.

## Acceptance criteria

- On Payroll Master with a period loaded, focusing a time input gives
  `outline-style: solid`, `outline-width: 2px`, `outline-color: rgb(27, 58, 107)`
  and `outline-offset: 2px`. **All four, not just the offset.**
- The same holds for a `<select>` in a grid cell and for a nav button.
- **Clicking with a mouse still draws no ring anywhere.**
- The ring is not clipped by the scrolling grid container.
- Every page loads with no console errors.

Then confirm every identifier used in the file is imported.
