export type Debounced<Args extends readonly unknown[]> = ((...args: Args) => void) & {
  readonly cancel: () => void;
  readonly flush: () => void;
};

export const SEARCH_DEBOUNCE_MS = 250;

export function debounce<Args extends readonly unknown[]>(
  _fn: (...args: Args) => void,
  _delayMs: number = SEARCH_DEBOUNCE_MS,
): Debounced<Args> {
  throw new Error('debounce is not implemented yet');
}
