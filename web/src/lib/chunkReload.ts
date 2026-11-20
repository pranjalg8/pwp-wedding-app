const RELOAD_FLAG = 'pwp.chunkReloadAt';
const RELOAD_WINDOW_MS = 60_000;

// After a new deploy, an open tab can ask for a page file that no longer exists. A dynamic import then fails.
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch dynamically|ChunkLoadError|Unable to preload CSS/i.test(msg);
}

/**
 * Reload once to pick up the new files. Returns false (and does nothing) if we already reloaded in the last minute,
 * so a genuinely broken build cannot cause a reload loop.
 */
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG));
    if (Number.isFinite(last) && Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    return false; // storage blocked: cannot guard against a loop, so do not reload automatically
  }
  window.location.reload();
  return true;
}
