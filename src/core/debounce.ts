export type Debounced<Args extends readonly unknown[]> = ((...args: Args) => void) & {
  readonly cancel: () => void;
  readonly flush: () => void;
};

export const SEARCH_DEBOUNCE_MS = 250;

export function debounce<Args extends readonly unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): Debounced<Args> {
  if (typeof fn !== 'function') {
    throw new TypeError('debounce expects a function as the first argument');
  }

  const delay = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingArgs: Args | undefined;

  const clearTimer = (): void => {
    if (timer === undefined) {
      return;
    }
    clearTimeout(timer);
    timer = undefined;
  };

  const invoke = (): void => {
    const args = pendingArgs;
    clearTimer();
    pendingArgs = undefined;
    if (args !== undefined) {
      fn(...args);
    }
  };

  const debounced = (...args: Args): void => {
    pendingArgs = args;
    clearTimer();
    timer = setTimeout(invoke, delay);
  };

  return Object.assign(debounced, {
    cancel: (): void => {
      clearTimer();
      pendingArgs = undefined;
    },
    flush: (): void => {
      if (timer !== undefined) {
        invoke();
      }
    },
  });
}
