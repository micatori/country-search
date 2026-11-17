const TIMEOUT_MESSAGE = 'The operation timed out';

/**
 * Timeout source. AbortSignal.timeout is preferred; the manual twin keeps the same
 * TimeoutError contract for runtimes without it.
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException(TIMEOUT_MESSAGE, 'TimeoutError')), timeoutMs);
  return controller.signal;
}

/**
 * Merges cancellation sources into one signal so a single fetch is cancellable both by
 * new user input and by the timeout budget.
 */
export function combineSignals(signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  const present = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  const [first, ...rest] = present;

  if (first === undefined) {
    return new AbortController().signal;
  }
  if (rest.length === 0) {
    return first;
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([first, ...rest]);
  }

  const controller = new AbortController();
  const abortWith = (source: AbortSignal): void => {
    if (!controller.signal.aborted) {
      controller.abort(source.reason);
    }
  };

  for (const signal of [first, ...rest]) {
    if (signal.aborted) {
      abortWith(signal);
      break;
    }
    signal.addEventListener('abort', () => abortWith(signal), { once: true });
  }

  return controller.signal;
}
