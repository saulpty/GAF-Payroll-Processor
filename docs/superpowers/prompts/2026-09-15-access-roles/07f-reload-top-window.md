# 07f — Fix: "View as" and Retry land on "Page not found"

## Files that may change

- `src/app/context/ViewerContext.tsx`
- `src/app/components/AccessGate.tsx`

No other file may be touched.

## What happened

The previous round made `setViewAs` and the gate's Retry call
`window.location.reload()`. On `/dev` (and in the released app) this app runs
**inside an iframe** whose own URL is an internal workbench address. Reloading
the iframe by itself loads that address directly and shows UI Bakery's
**"Page not found"** screen. Clicking **View as** on Admin > Access > Users now
does exactly that.

The outer page (the browser tab) is on the same origin and already carries the
app's current route in its URL, so reloading **the top window** restarts the app
correctly.

## 1. `src/app/context/ViewerContext.tsx`

Add, above `ViewerProvider`, and export it:

```ts
/** Restart the whole app. The app runs inside an iframe; reloading only the
 *  iframe shows "Page not found", so reload the top window when we can. */
export function reloadApp(): void {
  try {
    if (window.top && window.top !== window) {
      window.top.location.reload();
      return;
    }
  } catch {
    /* top window not reachable — fall back to this frame */
  }
  window.location.reload();
}
```

In `setViewAs`, replace `window.location.reload();` with `reloadApp();`.
Nothing else changes.

## 2. `src/app/components/AccessGate.tsx`

- Import `reloadApp` from `@/app/context/ViewerContext` (alongside `useViewer`).
- The Retry button's `onClick={() => window.location.reload()}` becomes
  `onClick={reloadApp}`.

Nothing else changes.

## Acceptance

1. Lint clean.
2. Confirm `window.location.reload` appears only inside `reloadApp`.
3. Then confirm every identifier used in both files is imported.

Do not build anything else.
