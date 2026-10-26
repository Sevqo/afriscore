/** Suppresses stale completions after navigation, environment or tenant changes. */
export function createRequestGate() {
  let version = 0;
  return {
    invalidate() {
      version++;
    },
    begin() {
      const current = ++version;
      return () => current === version;
    },
  };
}
