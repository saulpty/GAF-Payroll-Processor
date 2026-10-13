# Activity: the opened row is 20px too wide on a narrow window

**One edit, character for character. Only `src/app/pages/attendance/activity/ActivityByEmployee.tsx` may change. No other file may be touched.**

Measured on /dev: the visible table area is the window width minus 70px (page padding, borders and the two scrollbars), not minus 50px, so the opened row overflowed by 20px.

Replace

```tsx
const OPENED_WIDTH = { width: 'min(100%, calc(100vw - 50px))' };
```

with

```tsx
const OPENED_WIDTH = { width: 'min(100%, calc(100vw - 72px))' };
```

Change nothing else.

When done, reply with one line.
