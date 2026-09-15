# UIB identity probe — 2026-09-15 (prompt 00, access roles)

Question: how does GAF Panama HR Hub know who is signed in?

## Result

| Fact | Status |
|---|---|
| `{{user.email}}` is a valid placeholder inside a SQL action's `query` | **verified**: `SELECT {{user.email}} AS email` ran in the builder and returned one row |
| The value comes back with the SSO casing: `Saul.F@vitasyahc.com` | **verified**: capital S and F |
| React can read the user with `import { useUser } from '@uibakery/data'; const user = useUser();` returning email, name, role, roles | UIB's AI cited its own doc `app-and-user-context.md`; not run in a page |
| The user object carries a `role` / `roles` that UIB SSO rules set | cited, not run |
| Substitution happens on the server, so a browser cannot change it | **not verified** |

UI Bakery version in the panel: v6.16.1 (app version badge).

## What this decides

- The plan's `VIEWER` expression is `access_viewer({{user.email}}, {{params.viewAs}})`.
  No viewer email is passed from React to scoped loaders.
- **Every comparison lower-cases both sides.** SSO hands back mixed case, and
  `app_users.email` is stored lower-cased. `access_viewer` already calls `lower()`.
- `ViewerContext` loads the viewer with `loadCurrentViewer` (SQL, `{{user.email}}`);
  `useUser()` is only used for the display name if needed.
- Open: confirm server-side substitution before telling Saul that manager scoping
  cannot be bypassed from the browser. Cheap test later: view the network payload
  of `loadWhoAmI` on /dev and check that no email is sent from the browser.

`src/actions/loadWhoAmI.ts` stays as a throwaway probe until the roles work
lands; remove it in the wrap-up prompt.
