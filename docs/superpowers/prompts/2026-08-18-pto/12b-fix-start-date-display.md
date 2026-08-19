One small display fix on the PTO Balances tab. Change only `src/app/pages/pto/BalancesRow.tsx`, and `src/app/pages/pto/BalancesTab.tsx` if the formatting genuinely belongs there instead. No other file may change.

The START column renders raw ISO timestamps like `2026-02-02T00:00:00.000Z`. It should read `2026-02-02`.

The value arrives that way because `loadPtoBalancesInputs` returns a timestamp rather than a plain date string. The accrual maths is unaffected — `ptoAccrual.ts` slices the first 10 characters before parsing — so this is presentation only. Do **not** change the SQL, and do **not** change anything in `ptoAccrual.ts`.

Fix it in the component by displaying `String(start).slice(0, 10)`.

Do not use `toLocaleDateString`, `new Date(...)`, `Intl.DateTimeFormat`, or any other conversion. This codebase has roughly ten migrations that are all successive fixes to the same timezone bug, and a date that renders one day earlier in one timezone is exactly that bug returning. Slicing the string cannot shift a date; converting it can.

Apply the same treatment anywhere else on this tab that shows a raw date, if any.

Acceptance: the START column shows `2026-02-02` style dates; Accrued and Available are unchanged (Alanis Chena still reads 17.91 with As-of 2026-08-19); no `Date` construction or locale formatting was introduced.
