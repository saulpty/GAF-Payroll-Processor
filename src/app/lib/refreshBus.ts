// Plumbing for the top-bar Refresh button. Each background sync registers its runner here
// (only while a super user is signed in); the button runs them all with force = true.
// Pure module: no imports.

type SyncRunner = (force?: boolean) => Promise<void>;

const runners = new Map<string, SyncRunner>();

export function registerSync(name: string, run: SyncRunner): () => void {
  runners.set(name, run);
  return () => { if (runners.get(name) === run) runners.delete(name); };
}

/** Runs every registered sync now, ignoring the interval. Never throws. */
export async function runAllSyncs(): Promise<void> {
  await Promise.allSettled([...runners.values()].map(run => run(true)));
}
