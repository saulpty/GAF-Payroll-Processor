# Remove the temporary probe action

Delete `src/actions/zzProbeTeramind.ts` if it exists. **No other file may be touched.**

It was a throwaway transport created by the previous prompt (`00-probe.md`) and is imported by
nothing. It must not remain in the app: it forwards any URL and body to the Teramind datasource.

## Acceptance

1. `src/actions/zzProbeTeramind.ts` does not exist.
2. No other file was created, modified or deleted.
3. Nothing imports `zzProbeTeramind`.
