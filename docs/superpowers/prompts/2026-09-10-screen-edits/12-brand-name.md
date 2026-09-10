# 12 — The nav reads "GAF Panama / HR Hub"

Saul is renaming the app to *GAF Panama HR Hub*. The logo image follows in a
later prompt once the file exists; this prompt is the wording only.

## Files you may change

- `src/app/TopNav.tsx` — the brand block only (two text spans)

**No other file may be touched.** Nothing else in `TopNav.tsx` changes.

## Change

In the brand block, the two spans that read `GAF` and `Healthcare` become
`GAF` and `Panama` (same classes, same colours). The small line under them
stays `HR Hub`. The logomark and its click target are untouched.

## Verify

- The top-left of every page reads **GAF Panama** with *HR Hub* under it.
- Only `TopNav.tsx` changed, by exactly one word. Confirm every identifier used
  is imported.
