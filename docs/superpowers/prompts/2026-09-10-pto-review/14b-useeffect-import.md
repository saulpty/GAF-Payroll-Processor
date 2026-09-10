# 14b — ProcessPayroll crashes: `useEffect is not defined`

`/process` now shows "Something went wrong"; console: `ReferenceError:
useEffect is not defined`. Prompt 14 added a `useEffect` but the file's React
import is `import { useState, useRef, useMemo } from 'react';`.

## Files you may change

- `src/app/pages/ProcessPayroll.tsx` — the import line only

**No other file, no other line.** Change line 1 to
`import { useState, useRef, useMemo, useEffect } from 'react';`
Then confirm every identifier used in the file is imported.

## Verify

`/process` renders; the Period Name field is pre-filled with the period after
the latest one and both dates are filled.
