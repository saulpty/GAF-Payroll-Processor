# 07 — Hub Probe Results

Date: 2026-09-24

## Results table

| # | Question | Result |
|---|---|---|
| 1 | Rows in `disciplinary_admins` (email, name) | `saul.f@vitasyahc.com` / Saul Fallembaum; `tim.m@vitasyahc.com` / Timothy Moore |
| 2 | `me` / `is_admin` for the signed-in user | `me = saul.f@vitasyahc.com` / `is_admin = true` |
| 3 | Missing columns (if any) | None — all 5 present: `deleted_at`, `edited_at`, `edited_by`, `pdf_en_base64`, `pdf_en_original_base64` |
| 4 | actions / with_pdf / with_original / deleted | 17 / 11 / 0 / 0 |
| 5a | Exact `datasourceName` strings available to this app | `GAF Planilla DB`, `Monday.com API`, `SAUL Disciplinary Action Forms DB`, `Teramind API` |
| 5b | `Email Passiontocare` connected to this app? | **No — exists in workspace but not connected to this app** |
| 6 | Temporary action created/deleted? | Yes — `actions/probeDisciplinaryAccess.ts` created and confirmed deleted |

## Notes

- **Query 2 confirms Saul is admin** (`is_admin = true`). The lock in prompt 09 will pass for Saul.
- **`with_original = 0`**: No row yet has a `pdf_en_original_base64`. The first edit will populate it (original PDF preserved on first edit, then `pdf_en_base64` is overwritten).
- **`deleted = 0`**: No soft-deleted rows yet.
- **`Email Passiontocare`** must be connected to this app by Saul on the UIB connections screen before prompt 09 is run. Once connected, it will appear as a fifth datasource name available here.
- Query 3 was confirmed via `SELECT … LIMIT 0` (all 5 columns resolved without error). The information_schema path was blocked by the inspect-actions guardrail.
