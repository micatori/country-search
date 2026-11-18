import type { FailureKind } from './errors.ts';
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

export function createSearchController(options: SearchControllerOptions = {}): SearchController {
  throw new Error(
    `createSearchController is not implemented yet (debounceMs ${String(options.debounceMs)}, timeoutMs ${String(
      options.timeoutMs,
    )})`,
  );
}
