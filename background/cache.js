const FRESH_MS = 60_000;
const STALE_MS = 300_000;
const MAX_ENTRIES = 100;

const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.ts;
  if (age > STALE_MS) {
    store.delete(key);
    return null;
  }
  return { data: entry.data, fresh: age <= FRESH_MS };
}

export function cacheSet(key, data) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(key, { data, ts: Date.now() });
}

export function cacheClear() {
  store.clear();
}
