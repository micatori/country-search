import { cacheKeyOf } from './cache.ts';

export const HISTORY_STORAGE_KEY = 'country-search:history';
export const DEFAULT_HISTORY_LIMIT = 8;

/** Longer stored queries would let the UI wrap badly and inflate the payload. */
export const MAX_QUERY_LENGTH = 64;

export interface SearchHistory {
  push(query: string): void;
  list(): readonly string[];
  has(query: string): boolean;
  remove(query: string): void;
  clear(): void;
}

/** Minimal structural contract of Storage, so the module also works in restricted browsers. */
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SearchHistoryOptions {
  readonly key?: string;
  readonly limit?: number;
  readonly storage?: StorageLike;
}

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key: string): string | null => values.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      values.set(key, value);
    },
    removeItem: (key: string): void => {
      values.delete(key);
    },
  };
}

/**
 * localStorage throws instead of degrading: it is absent for opaque origins (file://), blocked
 * by cookie/storage permissions, and it throws QuotaExceededError in Safari private mode.
 * A probe write is the only reliable way to learn that before the first real write.
 */
function detectStorage(): StorageLike | undefined {
  try {
    if (typeof localStorage === 'undefined') {
      return undefined;
    }

    const probeKey = `${HISTORY_STORAGE_KEY}:probe`;
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    return localStorage;
  } catch (_error) {
    return undefined;
  }
}

const toDisplayQuery = (query: string): string => {
  const collapsed = query.trim().replace(/\s+/g, ' ');
  return collapsed.length <= MAX_QUERY_LENGTH ? collapsed : collapsed.slice(0, MAX_QUERY_LENGTH).trim();
};

/**
 * Stored data is attacker-visible: DevTools, another extension or a corrupted profile can put
 * anything under our key. Every entry is re-validated, so a hostile payload degrades to an
 * empty history instead of feeding junk (or objects) into the UI.
 */
function sanitizeList(payload: unknown, limit: number): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const unique = new Set<string>();
  const seenKeys = new Set<string>();

  for (const item of payload) {
    if (typeof item !== 'string') {
      continue;
    }

    const display = toDisplayQuery(item);
    const key = cacheKeyOf(display);
    if (display === '' || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    unique.add(display);
    if (unique.size >= limit) {
      break;
    }
  }

  return [...unique];
}

function readStoredEntries(storage: StorageLike, key: string, limit: number): string[] {
  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return [];
    }
    return sanitizeList(JSON.parse(raw), limit);
  } catch (_error) {
    return []; // unreadable JSON is a missing history, never a search failure
  }
}

/**
 * Most-recent-first list of queries the user actually ran, persisted per browser.
 * Index 0 is the last query, so the UI renders it top-down without reversing.
 */
export function createSearchHistory(options: SearchHistoryOptions = {}): SearchHistory {
  const key = options.key ?? HISTORY_STORAGE_KEY;
  const limit =
    Number.isInteger(options.limit) && (options.limit as number) > 0
      ? (options.limit as number)
      : DEFAULT_HISTORY_LIMIT;
  const storage = options.storage ?? detectStorage() ?? createMemoryStorage();

  let entries = readStoredEntries(storage, key, limit);

  function persist(): void {
    try {
      storage.setItem(key, JSON.stringify(entries));
    } catch (_error) {
      // History is a convenience: quota or a disabled storage must never break searching.
    }
  }

  return {
    push(query: string): void {
      const display = toDisplayQuery(query);
      if (display === '') {
        return; // a blank field is not a query the user searched for
      }

      const key_ = cacheKeyOf(display);
      entries = [display, ...entries.filter((entry) => cacheKeyOf(entry) !== key_)].slice(0, limit);
      persist();
    },

    list(): readonly string[] {
      return [...entries];
    },

    has(query: string): boolean {
      const key_ = cacheKeyOf(query);
      return key_ !== '' && entries.some((entry) => cacheKeyOf(entry) === key_);
    },

    remove(query: string): void {
      const key_ = cacheKeyOf(query);
      const kept = entries.filter((entry) => cacheKeyOf(entry) !== key_);
      if (kept.length === entries.length) {
        return;
      }
      entries = kept;
      persist();
    },

    clear(): void {
      entries = [];
      try {
        storage.removeItem(key);
      } catch (_error) {
        // same reasoning as persist()
      }
    },
  };
}
