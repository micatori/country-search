/** Status countries.dev uses for "no matches" — a valid empty result, not a failure. */
export const NO_MATCH_STATUS = 404;

export type FailureKind = 'aborted' | 'timeout' | 'http' | 'network' | 'invalid-response' | 'unknown';

export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;

  constructor(status: number, statusText: string, url: string) {
    super(`Request ${url} failed with status ${status}${statusText ? ` ${statusText}` : ''}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
  }
}

export class InvalidPayloadError extends Error {
  constructor(url: string) {
    super(`Response from ${url} is not a readable JSON payload`);
    this.name = 'InvalidPayloadError';
  }
}

const nameOf = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string' ? error.name : '';

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function isNoMatches(error: unknown): boolean {
  return isHttpError(error) && error.status === NO_MATCH_STATUS;
}

export function isAbortError(error: unknown): boolean {
  return nameOf(error) === 'AbortError';
}

export function isTimeoutError(error: unknown): boolean {
  return nameOf(error) === 'TimeoutError';
}

const isNetworkError = (error: unknown): boolean => error instanceof TypeError || nameOf(error) === 'NetworkError';

const isSyntaxError = (error: unknown): boolean => error instanceof SyntaxError || nameOf(error) === 'SyntaxError';

/**
 * Decides which user-facing branch a caught rejection belongs to.
 * The reason stored on an aborted signal wins over the thrown error name: a combined
 * signal (AbortSignal.any([userInput, timeout])) may reject with AbortError even when
 * the real cause was the timeout budget.
 */
export function classifyFailure(error: unknown, abortedSignal?: AbortSignal): FailureKind {
  const reason: unknown = abortedSignal?.aborted ? abortedSignal.reason : undefined;

  if (isTimeoutError(error) || isTimeoutError(reason)) {
    return 'timeout';
  }

  if (isAbortError(error) || isAbortError(reason)) {
    return 'aborted';
  }

  if (isHttpError(error)) {
    return 'http';
  }

  if (isNetworkError(error)) {
    return 'network';
  }

  if (isSyntaxError(error) || error instanceof InvalidPayloadError) {
    return 'invalid-response';
  }

  return 'unknown';
}
