const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();
const pendingCache = new Map<string, Promise<unknown>>();
const CACHE_PREFIX = "agenthub.session-cache.";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function getStorageKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

function readStorageRecord<T>(key: string, allowExpired = false) {
  if (!canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { value: T; expiresAt: number };
    if (!parsed || typeof parsed.expiresAt !== "number") {
      window.sessionStorage.removeItem(getStorageKey(key));
      return null;
    }

    if (!allowExpired && Date.now() >= parsed.expiresAt) {
      window.sessionStorage.removeItem(getStorageKey(key));
      return null;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(getStorageKey(key));
    return null;
  }
}

function writeStorageRecord<T>(key: string, value: T, expiresAt: number) {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(getStorageKey(key), JSON.stringify({ value, expiresAt }));
  } catch {
    window.sessionStorage.removeItem(getStorageKey(key));
  }
}

export function invalidateSessionCache(keys: string | string[]) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    memoryCache.delete(key);
    pendingCache.delete(key);
    if (canUseSessionStorage()) {
      window.sessionStorage.removeItem(getStorageKey(key));
    }
  }
}

export function invalidateSessionCacheByPrefix(prefixes: string | string[]) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const prefix of list) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key);
        pendingCache.delete(key);
      }
    }

    if (!canUseSessionStorage()) {
      continue;
    }

    const keysToRemove: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(getStorageKey(prefix))) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  }
}

export function clearAllSessionCache() {
  memoryCache.clear();
  pendingCache.clear();

  if (!canUseSessionStorage()) return;

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.sessionStorage.removeItem(key);
  }
}

export function primeSessionCache<T>(key: string, value: T, ttlMs: number) {
  const expiresAt = Date.now() + ttlMs;
  memoryCache.set(key, { value, expiresAt });
  writeStorageRecord(key, value, expiresAt);
}

export async function getOrFetchSessionCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
) {
  const memoryRecord = memoryCache.get(key);
  if (memoryRecord && Date.now() < memoryRecord.expiresAt) {
    return memoryRecord.value as T;
  }

  const storageRecord = readStorageRecord<T>(key);
  if (storageRecord) {
    memoryCache.set(key, storageRecord);
    return storageRecord.value;
  }

  const pending = pendingCache.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const request = fetcher()
    .then((value) => {
      primeSessionCache(key, value, ttlMs);
      pendingCache.delete(key);
      return value;
    })
    .catch((error) => {
      pendingCache.delete(key);
      throw error;
    });

  pendingCache.set(key, request);
  return request;
}

export function peekSessionCache<T>(key: string, options?: { allowExpired?: boolean }) {
  const allowExpired = options?.allowExpired ?? false;
  const memoryRecord = memoryCache.get(key);
  if (memoryRecord && (allowExpired || Date.now() < memoryRecord.expiresAt)) {
    return memoryRecord.value as T;
  }

  const storageRecord = readStorageRecord<T>(key, allowExpired);
  if (!storageRecord) {
    return null;
  }

  memoryCache.set(key, storageRecord);
  return storageRecord.value;
}

export async function prefetchSessionCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
) {
  try {
    await getOrFetchSessionCached(key, ttlMs, fetcher);
  } catch {
    // Keep prefetch failures silent so route rendering is unaffected.
  }
}
