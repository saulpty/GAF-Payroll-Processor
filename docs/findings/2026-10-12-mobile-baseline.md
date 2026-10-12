# How the app looks on a phone today (2026-10-12)

Evidence for `docs/superpowers/specs/2026-10-12-mobile-view-design.md`. Nothing was changed to
produce this: the draft app (`/dev`) was opened in a separate Chrome tab and its frame was
narrowed to a phone's width (375 wide, about 815 tall) with a one-off script. No builder tab, no
prompt, no export.

Screenshots: `docs/assets/2026-10-12-mobile-baseline/` (`today.png`, `pto.png`, `contracts.png`). The Disciplinary capture is not kept in the
repository because it shows who has a record.

## What a person holding a phone runs into

| # | Problem | Measured |
|---|---|---|
| 1 | **There is no way to change section.** The row of sections (Payroll, Attendance, …) is squeezed to nothing by the logo, the Refresh pill and the name pill. | Section row width: **0 px** |
| 2 | The name pill is cut off at the right edge ("Saul Fallembaum · Super U…"). | visible in every screenshot |
| 3 | The filters stack under the tabs and eat the top of the screen. | White bar: **177 px** on Today / PTO / Contracts / Disciplinary, **243 px** on List and Reports, **257 px** on Activity (desktop: 48) |
| 4 | So the page itself gets about two thirds of the screen, and on Today the nine tiles use most of that before the first employee. | Page area: 502–582 px of 815 |
| 5 | On Attendance, the tabs after "List" (Reports) are off the right edge with no hint that the strip scrolls. | `today.png` |
| 6 | Every table is far wider than the screen and scrolls sideways inside a small box; the employee's name scrolls away. | Table width vs box: PTO 1426 / 321, Contracts 1502 / 321, Attendance List 2079 / 320, Disciplinary 882 / 321, Activity 811 / 322, Admin Employees 900 / 306 |
| 7 | Page headers do not wrap: the subtitle is crushed into a one-word-per-line column and the buttons run off the screen. The whole page then slides sideways. | `pto.png` (orange Add Manually cut off); Disciplinary (subtitle one word per line; page 813 px wide in a 375 px screen) |
| 8 | **The employee side panel cannot be used.** It is at least 520 px wide and pinned to the right edge, so its left 145 px, including the start of the name and of every row, is off-screen and unreachable. | Panel box: x = −145, width 520 |
| 9 | Admin: with the tabs and header, the page area is under a quarter of the screen. | Admin → Employees page area: **193 px** of 815 |
| 10 | Explanations that appear on mouse-over (the small ⓘ marks, status meanings, why a button is disabled) never appear on a touch screen. | from the code: all are `title=` only |

## From reading the code (not visible in a screenshot)

- Only 14 places in the whole app adapt to screen width. Everything else is fixed for a desktop.
- Pop-up dialogs (Record PTO, Close Case, Delete, Thresholds) are centred with no height limit and no
  scrolling. With the phone keyboard open, the Save button can end up off-screen with no way to reach it.
- Three payroll/admin pages break *inside* files on the do-not-touch list if they are simply squeezed
  to phone width: Payroll Master (pinned columns cover the table), Rules & Config (Edit/Delete
  column clipped with no scrollbar), Process Payroll (name-matching step). They are fine if the
  page is kept at desktop width and panned. See the spec, "Payroll and Admin".
- Phone browsers zoom the page when you tap a text box whose text is smaller than 16 px. Every
  input in the app is 13–14 px.

## Not checked yet

- **A real phone.** This was a narrowed desktop browser. It does not show the phone keyboard, the
  browser's own bars, or how UI Bakery itself frames the app on a phone at the live address.
  That is step 0 of the plan and needs Saul's phone.
- Attendance List, Activity, Reports, Payroll Master and Admin were measured but their screenshots
  did not save (the Chrome window was resized mid-capture). Numbers above are from the page itself.
