# Fix: restore the List table headers exactly as specified (step 4b deviated)

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.**

Step 4b's export differed from the prompt in one block of `AttendanceTable.tsx`: the column
headers were renamed ("Reported Late", "Unreported Late", "Avg Min Late", "On-Time %", "1–10 min"…)
and **% On-Time lost its sorting**. `pctOnTime` is a valid sort key (`keyof EmpStats`), so no
change was needed. Put the block back exactly as specified — nothing else changes.

**Only this file may change:** `src/app/pages/attendance/AttendanceTable.tsx` — exactly this one
replacement. No other line and no other file may be touched.

Replace exactly

```tsx
              <Th label="Reported Late"    col="reported"    tooltip="Late days with an attendance form on file." />
              <Th label="Unreported Late"  col="unreported"  tooltip="Late days with no attendance form on file." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled to work but no clock-in and no time off or permission." />
              <Th label="Avg Min Late"     col="avgMinLate"  tooltip="Average minutes late across late days only." />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-border whitespace-nowrap cursor-default">
                On-Time %
              </th>
              <Th label="1–10 min"         col="b1to10"      tooltip="Late days where the delay was 1–10 minutes." />
              <Th label="11–30 min"        col="b11to30"     tooltip="Late days where the delay was 11–30 minutes." />
              <Th label="31+ min"          col="b31plus"     tooltip="Late days where the delay was more than 30 minutes." />
```

with exactly

```tsx
              <Th label="Reported"         col="reported"    tooltip="Late days that had a GAF Attendance form on file." />
              <Th label="Unreported"       col="unreported"  tooltip="Late days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (Worked)" col="avgMinLate"  tooltip="Average minutes late across the days someone actually worked." />
              <Th label="% On-Time"        col="pctOnTime"   tooltip="On Time ÷ Expected. Green 90%+, amber 75–89%, red below 75%." />
              <Th label="1–10m"            col="b1to10"      tooltip="Late days where the delay was 1 to 10 minutes." />
              <Th label="11–30m"           col="b11to30"     tooltip="Late days where the delay was 11 to 30 minutes." />
              <Th label="31+m"             col="b31plus"     tooltip="Late days where the delay was more than 30 minutes." />
```

## Report
- Byte size of `AttendanceTable.tsx`; confirm no other file or line changed; Attendance → List
  sorts by % On-Time when its header is clicked; no console errors.
