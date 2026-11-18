import { searchCountries } from './api.ts';
import type { SearchOptions } from './api.ts';
import { SEARCH_DEBOUNCE_MS, debounce } from './debounce.ts';
import { classifyFailure } from './errors.ts';
import type { FailureKind } from './errors.ts';
import { mapCountryResponses } from './mapping.ts';
import type { CountryView } from './mapping.ts';

export type SearchStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

export interface SearchFailure {
  readonly kind: FailureKind;
  readonly message: string;
}

export interface SearchState {
  readonly query: string;
  readonly status: SearchStatus;
  readonly results: readonly CountryView[];
  readonly failure: SearchFailure | null;
}

export interface SearchControllerOptions {
  readonly debounceMs?: number;
  readonly timeoutMs?: number;
  readonly baseUrl?: string;
  readonly onStateChange?: (state: SearchState) => void;
}

export interface SearchController {
  readonly state: SearchState;
  handleInput(query: string): void;
  submit(query?: string): void;
  retry(): void;
  clear(): void;
  destroy(): void;
}

export const IDLE_SEARCH_STATE: SearchState = {
  query: '',
  status: 'idle',
  results: [],
  failure: null,
};

interface ActiveRequest {
  readonly controller: AbortController;
  readonly requestId: number;
}

/**
 * Owns the whole search lifecycle — debounce, one in-flight AbortController, timeout,
 * loading/empty/error/success states. Deliberately DOM-free, which is what makes the stale
 * response race testable without a browser.
 */
export function createSearchController(options: SearchControllerOptions = {}): SearchController {
  const { debounceMs = SEARCH_DEBOUNCE_MS, timeoutMs, baseUrl, onStateChange } = options;

  let state: SearchState = IDLE_SEARCH_STATE;
  let activeRequest: ActiveRequest | undefined;
  let session = 0;
  let lastQuery = '';

  const debouncedRun = debounce((query: string, requestId: number): void => run(query, requestId), debounceMs);

  function publish(next: SearchState): void {
    state = next;
    onStateChange?.(state);
  }

  /**
   * Secondary invariant, not the cancellation mechanism. The real cancellation is
   * AbortController.abort(); this guard only closes the window where the response already
   * settled before abort() ran and its .then continuation is still queued in the microtask queue.
   */
  const isSuperseded = (candidate: ActiveRequest): boolean =>
    candidate !== activeRequest || candidate.requestId !== session;

  function cancelActiveRequest(): void {
    activeRequest?.controller.abort();
    activeRequest = undefined;
  }

  /**
   * exactOptionalPropertyTypes means an absent option must stay absent — assigning
   * { timeoutMs: undefined } would make "no timeout" and "undefined timeout" indistinguishable.
   */
  function buildSearchOptions(): SearchOptions {
    return {
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(baseUrl === undefined ? {} : { baseUrl }),
    };
  }

  function run(query: string, requestId: number): void {
    const trimmedQuery = query.trim();
    if (trimmedQuery === '' || requestId !== session) {
      return;
    }

    cancelActiveRequest();

    const request: ActiveRequest = { controller: new AbortController(), requestId };
    activeRequest = request;
    publish({ query: trimmedQuery, status: 'loading', results: [], failure: null });

    searchCountries(trimmedQuery, request.controller.signal, buildSearchOptions())
      .then((payload) => {
        if (isSuperseded(request)) {
          return;
        }
        const results = mapCountryResponses(payload);
        publish({
          query: trimmedQuery,
          status: results.length === 0 ? 'empty' : 'success',
          results,
          failure: null,
        });
      })
      .catch((error: unknown) => {
        const kind = classifyFailure(error, request.controller.signal);
        if (kind === 'aborted') {
          return; // our own cancellation: silent, never shown as an error
        }
        if (isSuperseded(request)) {
          return;
        }
        publish({
          query: trimmedQuery,
          status: 'error',
          results: [],
          failure: { kind, message: error instanceof Error ? error.message : String(error) },
        });
      })
      .finally(() => {
        if (activeRequest === request) {
          activeRequest = undefined;
        }
      });
  }

  function handleInput(query: string): void {
    session += 1;
    cancelActiveRequest(); // ← every keystroke cancels, not only when debounce fires
    debouncedRun.cancel();
    lastQuery = query;

    if (query.trim() === '') {
      publish({ ...IDLE_SEARCH_STATE, query });
      return;
    }

    publish({ query, status: 'loading', results: [], failure: null });
    debouncedRun(query, session);
  }

  function submit(query: string = state.query): void {
    session += 1;
    debouncedRun.cancel();
    lastQuery = query;
    run(query, session);
  }

  return {
    get state(): SearchState {
      return state;
    },
    handleInput,
    submit,
    retry(): void {
      submit(lastQuery); // repeats exactly the last typed query, never an older one
    },
    clear(): void {
      handleInput('');
      lastQuery = '';
    },
    destroy(): void {
      session += 1;
      cancelActiveRequest();
      debouncedRun.cancel();
    },
  };
}
