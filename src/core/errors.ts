export const NO_MATCH_STATUS = 404;

export type FailureKind = 'aborted' | 'timeout' | 'http' | 'network' | 'invalid-response' | 'unknown';

export class HttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;

  constructor(status: number, statusText: string, url: string) {
    super(`HttpError is not implemented yet (${status} ${statusText} for ${url})`);
    this.status = status;
    this.statusText = statusText;
    this.url = url;
  }
}

export class InvalidPayloadError extends Error {
  constructor(url: string) {
    super(`InvalidPayloadError is not implemented yet (${url})`);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  throw new Error(`isHttpError is not implemented yet (typeof ${typeof error})`);
}

export function isNoMatches(error: unknown): boolean {
  throw new Error(`isNoMatches is not implemented yet (typeof ${typeof error})`);
}

export function isAbortError(error: unknown): boolean {
  throw new Error(`isAbortError is not implemented yet (typeof ${typeof error})`);
}

export function isTimeoutError(error: unknown): boolean {
  throw new Error(`isTimeoutError is not implemented yet (typeof ${typeof error})`);
}

export function classifyFailure(error: unknown, abortedSignal?: AbortSignal): FailureKind {
  throw new Error(`classifyFailure is not implemented yet (typeof ${typeof error}, signal ${String(abortedSignal)})`);
}
