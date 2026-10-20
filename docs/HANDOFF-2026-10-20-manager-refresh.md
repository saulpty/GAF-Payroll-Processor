# Handoff 2026-10-20: Arelis + Marcela's Refresh pulls fresh data

## State: on the draft (/dev, v8.28.5). NOT yet released

The Release click was blocked by the session's auto-mode safety check. Saul to release
(staging first, then prod) or approve the click. The database part (migration 1782020000)
is already live, because the draft and prod share the GAF Planilla DB. It is harmless on its own:
prod's code doesn't read the new column yet.

## What changed (prompts `docs/superpowers/prompts/2026-10-20-manager-refresh/01-02`)

- `app_users.can_refresh_sync`, ticked for `arelis.a@vitasyahc.com` and `marcela.g@vitasyahc.com`.
  To add someone later: set it to true on their `app_users` row.
- `public.assert_sync_writer`: an active super user, or an active flagged user. Only the 11
  data-copy actions use it (Monday requests / attendance forms / contracts + their deleted
  flags, `claimSyncRun`, `upsertSyncLog`, `upsertMondaySyncLog`, Teramind sessions + pull log).
  Every other write keeps `assert_super`. Guarded by WL7/WL8.
- For a flagged manager, Refresh runs the requests, attendance_forms and contracts boards plus the
  Teramind punch pull. It never runs the directory board, the Teramind roster or access groups,
  and never on the timer. Guarded by RB4/RB7, T12.

## Checked on /dev

- Tests 957/958 (L2 pre-existing).
- Super view: PTO 44 employees. View As Arelis: 13 employees, no Payroll/Admin. Refresh called
  Monday x5 + Teramind x1, all 200. Monday cards afterwards: Requests 9:05, Forms 9:06,
  Contracts 9:06, Directory untouched (9:02).
- **Not checked:** the database lock with Arelis's own login. View As still sends Saul's real
  email, so the writes passed as a super user. The first real check is Arelis pressing Refresh
  after release, then the Monday cards' times moving.
