import { searchCountries } from './api.ts';
import type { SearchOptions } from './api.ts';
import type { RawCountry } from './types.ts';

export const DEFAULT_CACHE_CAPACITY = 64;

export interface CacheStats {
  readonly entries: number;
  readonly inFlight: number;
  readonly hits: number;
  readonly deduped: number;
  readonly misses: number;
  readonly evictions: number;
  readonly cancelledRequests: number;
}

export interface SearchCache {
  fetch(query: string, callerSignal?: AbortSignal, options?: SearchOptions): Promise<RawCountry[]>;
  peek(query: string): readonly RawCountry[] | undefined;
  has(query: string): boolean;
  invalidate(query?: string): void;
  clear(): void;
  stats(): CacheStats;
}

interface InFlightEntry {
  readonly controller: AbortController;
  promise: Promise<RawCountry[]>;
  subscribers: number;
  settled: boolean;
}

/**
 * countries.dev searches names case-insensitively, so "Spain", " spain " and "SPAIN" are the
 * same lookup and share one entry. If the upstream ever turns case-sensitive, dropping
 * toLowerCase() is the one-line fix — everything else keeps working.
 */
export const cacheKeyOf = (query: string): string => query.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Memoizes completed lookups and lets concurrent identical queries share a single request.
 *
 * Cancellation model: the signal that reaches fetch belongs to the entry, never to a caller.
 * Each caller gets its own promise wrapper around the caller's own AbortSignal, so aborting
 * one caller only cancels that caller's wait. The shared request is aborted once the last
 * subscriber leaves, which frees the connection without breaking anybody still waiting.
 */
export function createSearchCache(capacity: number = DEFAULT_CACHE_CAPACITY): SearchCache {
  const completed = new Map<string, RawCountry[]>();
  const inFlight = new Map<string, InFlightEntry>();
  const counters = { hits: 0, deduped: 0, misses: 0, evictions: 0, cancelledRequests: 0 };

  const isAborted = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

  function forgetInFlight(key: string, entry: InFlightEntry): void {
    if (inFlight.get(key) === entry) {
      inFlight.delete(key);
    }
  }

  /** LRU: re-inserting moves the key to the freshest position; Map keeps insertion order. */
  function remember(key: string, countries: readonly RawCountry[]): void {
    completed.delete(key);
    completed.set(key, [...countries]);

    while (completed.size > capacity) {
      const oldest = completed.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      completed.delete(oldest);
      counters.evictions += 1;
    }
  }

  /** Only a still-unfinished request may be aborted; a settled one has nothing left to cancel. */
  function release(key: string, entry: InFlightEntry): void {
    if (entry.settled) {
      return;
    }

    entry.subscribers -= 1;
    if (entry.subscribers > 0) {
      return;
    }

    forgetInFlight(key, entry);
    counters.cancelledRequests += 1;
    entry.controller.abort();
  }

  function startRequest(key: string, options: SearchOptions): InFlightEntry {
    const entry: InFlightEntry = {
      controller: new AbortController(),
      promise: Promise.resolve<RawCountry[]>([]),
      subscribers: 0,
      settled: false,
    };

    entry.promise = searchCountries(key, entry.controller.signal, options).then(
      (countries) => {
        entry.settled = true;
        forgetInFlight(key, entry);
        remember(key, countries);
        return countries;
      },
      (error: unknown) => {
        entry.settled = true;
        forgetInFlight(key, entry);
        throw error; // failures and cancellations are never cached: a retry must hit the network
      },
    );

    // A request nobody waits for anymore still has to end as "handled"; subscribers attach their
    // own handlers below and keep receiving the rejection.
    void entry.promise.catch(() => undefined);

    inFlight.set(key, entry);
    return entry;
  }

  /** Per-caller promise: the caller's signal cancels only this wrapper. */
  function attach(key: string, entry: InFlightEntry, callerSignal?: AbortSignal): Promise<RawCountry[]> {
    if (isAborted(callerSignal)) {
      return Promise.reject(callerSignal?.reason);
    }

    entry.subscribers += 1;

    return new Promise<RawCountry[]>((resolve, reject) => {
      const detach = (): void => {
        callerSignal?.removeEventListener('abort', onCallerAbort);
      };

      const onCallerAbort = (): void => {
        detach();
        release(key, entry);
        reject(callerSignal?.reason);
      };

      callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

      entry.promise.then(
        (countries) => {
          detach();
          resolve(countries);
        },
        (error: unknown) => {
          detach();
          reject(error);
        },
      );
    });
  }

  return {
    fetch(query: string, callerSignal?: AbortSignal, options: SearchOptions = {}): Promise<RawCountry[]> {
      const key = cacheKeyOf(query);
      if (key === '') {
        return Promise.resolve([]);
      }

      const cached = completed.get(key);
      if (cached !== undefined) {
        counters.hits += 1;
        completed.delete(key);
        completed.set(key, cached);
        return isAborted(callerSignal) ? Promise.reject(callerSignal?.reason) : Promise.resolve(cached);
      }

      const existing = inFlight.get(key);
      if (existing !== undefined) {
        counters.deduped += 1;
        return attach(key, existing, callerSignal);
      }

      counters.misses += 1;
      return attach(key, startRequest(key, options), callerSignal);
    },

    peek(query: string): readonly RawCountry[] | undefined {
      return completed.get(cacheKeyOf(query));
    },

    has(query: string): boolean {
      return completed.has(cacheKeyOf(query));
    },

    invalidate(query?: string): void {
      if (query === undefined) {
        completed.clear();
        return;
      }
      completed.delete(cacheKeyOf(query));
    },

    clear(): void {
      completed.clear();
    },

    stats(): CacheStats {
      return {
        entries: completed.size,
        inFlight: inFlight.size,
        hits: counters.hits,
        deduped: counters.deduped,
        misses: counters.misses,
        evictions: counters.evictions,
        cancelledRequests: counters.cancelledRequests,
      };
    },
  };
}
