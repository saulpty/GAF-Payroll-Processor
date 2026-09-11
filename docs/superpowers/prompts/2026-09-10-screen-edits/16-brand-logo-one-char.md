# 16 — One character is missing from P1 in `BrandLogo.tsx`

After prompt 15 the joined base64 is 6191 characters instead of 6192, so the
nav shows a broken image. The export shows exactly one character was dropped
from `P1` at offset 1529 (0-based). Nothing else is wrong.

## Files you may change

- `src/app/components/BrandLogo.tsx` — one insertion in the `P1` literal

**No other file may be touched.** Do not rewrite the file; make one edit.

## The edit

In the `P1` string, find the 12 characters `dtJoPPrAm9d9` (they occur once)
and insert `7` immediately after them, so that stretch reads
`dtJoPPrAm9d97/lz9pIoB`.

After the edit `P1` is 1548 characters long and still ends in `whlCRu1sp`.
`P2`, `P3`, `P4` are untouched.

## Verify

- Re-read the file: `P1.length === 1548`, `(P1+P2+P3+P4).length === 6192`.
- Only `BrandLogo.tsx` changed, by one character.
