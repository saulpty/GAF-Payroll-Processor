# 00 — Probe: how does this app know who is signed in?

## Files that may change

- `src/actions/loadWhoAmI.ts` (new)

No other file may be touched. Do not create, delete, rename or reformat
anything else. Do not add a page, a component, a migration, or a route.

## Why

We are about to build roles: super users see the whole app, managers see only
their own employees. The app must know the signed-in person's email (they
arrive through the company SSO). Nothing in `src/` reads the current user
today. Before designing around it, we need facts, not guesses.

## What to do

1. **Answer these questions in your reply, from your knowledge of this UI Bakery
   version (3.194.0, vibe project). Say "verified" only for what you actually
   run; mark the rest "not verified".**
   a. Inside a SQL action's `query`, is there a placeholder for the signed-in
      user's email (for example `{{user.email}}`)? Is it substituted on the
      server, so the browser cannot change it?
   b. In React code, what does `@uibakery/data` (or another UI Bakery module)
      export to read the current user (email, name, groups/roles)? Give the
      exact import and call.
   c. Does UI Bakery have app roles or user groups that code can read, and how?

2. Create `src/actions/loadWhoAmI.ts`, following the exact shape of
   `src/actions/loadHolidays.ts`:
   ```ts
   import { action } from '@uibakery/data';

   function loadWhoAmI() {
     return action('loadWhoAmI', 'SQL', {
       datasourceName: 'GAF Planilla DB',
       query: `
         SELECT {{user.email}} AS email;
       `,
     });
   }

   export default loadWhoAmI;
   ```
   If your answer to 1a names a different placeholder, use that one instead
   and say so.

3. **Run `loadWhoAmI` once** and report exactly what came back (the email
   string, `null`, or the error text).

## Acceptance

- Exactly one new file, `src/actions/loadWhoAmI.ts`.
- Your reply contains answers to 1a, 1b, 1c and the raw result of step 3.
- Then confirm every identifier used in the file is imported.

Do not build anything else. Do not offer to build the roles feature.
