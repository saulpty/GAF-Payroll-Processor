# 16c — Status column moves between Evidence and the buttons

## Files you may change

- `src/app/pages/pto/PtoBreakdown.tsx` — headers + colgroup order
- `src/app/pages/pto/PtoSubRow.tsx` — cell order

**No other file.** Headers become
`['Type', 'Requested', 'What payroll says', 'Evidence', 'Status', '']`, the
colgroup order follows (`w-28 · w-48 · w-60 · auto · w-28 · w-44`), and in
`PtoSubRow` the Status `<td>` is rendered before the actions `<td>`. Nothing
else changes.
