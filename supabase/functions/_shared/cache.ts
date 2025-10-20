type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCache<T>(key: string): T | undefined {
  const entry = cacheStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function clearCache(key?: string): void {
  if (key) {
    cacheStore.delete(key);
    return;
  }
  cacheStore.clear();
}
