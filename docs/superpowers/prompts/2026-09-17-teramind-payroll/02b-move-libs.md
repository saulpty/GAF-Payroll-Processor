# Move the five Teramind libs into the real lib folder

The previous prompt asked for five files under `src/app/lib/`. In this project the code root *is*
`src`, so the existing libs live at **`app/lib/`** (for example `app/lib/teramindParser.ts` and
`app/lib/classificationEngine.ts`). The five new files were created one level too deep, inside a
stray top-level folder named `src/`.

## Do exactly this

1. Move these five files, **content unchanged, byte for byte**, from `src/app/lib/` to `app/lib/`
   — the same folder that already holds `teramindParser.ts`:
   - `teramindTypes.ts`
   - `teramindTime.ts`
   - `teramindRows.ts`
   - `teramindPunches.ts`
   - `teramindPull.ts`
2. Delete the now-empty stray folder `src/` (and its `src/app/`, `src/app/lib/` subfolders).

**No other file may be created, modified or deleted.** Do not reformat the files. Nothing imports
them yet, so no import needs updating.

## Acceptance

1. `app/lib/teramindTime.ts` exists next to `app/lib/teramindParser.ts`, and likewise the other four.
2. No top-level `src/` folder remains in the project.
3. `app/lib/teramindTime.ts` is 5000 bytes, `teramindRows.ts` 6339, `teramindTypes.ts` 1527,
   `teramindPunches.ts` 2094, `teramindPull.ts` 2512.
4. No other file changed.
