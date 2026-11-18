import { describe, expect, it } from 'vitest';

import {
  HttpError,
  classifyFailure,
  isAbortError,
  isHttpError,
  isNoMatches,
  isTimeoutError,
} from '../../src/core/errors.ts';

const abortError = (): Error => new DOMException('This operation was aborted', 'AbortError');
const timeoutError = (): Error => new DOMException('The operation timed out', 'TimeoutError');

describe('HttpError', () => {
  it('is an Error that keeps the response status, statusText and url', () => {
    const error = new HttpError(500, 'Internal Server Error', 'https://countries.dev/name/spain');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HttpError);
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(500);
    expect(error.statusText).toBe('Internal Server Error');
    expect(error.url).toBe('https://countries.dev/name/spain');
    expect(error.message).toContain('500');
    expect(error.message).toContain('https://countries.dev/name/spain');
  });

  it('is distinguished from a plain error', () => {
    expect(isHttpError(new HttpError(503, 'Service Unavailable', 'https://countries.dev/name/sp'))).toBe(true);
    expect(isHttpError(new Error('boom'))).toBe(false);
    expect(isHttpError(undefined)).toBe(false);
    expect(isHttpError('string')).toBe(false);
  });
});

describe('404 means no matches and is not an error', () => {
  it('marks 404 as no matches', () => {
    expect(isNoMatches(new HttpError(404, 'Not Found', 'https://countries.dev/name/zzz'))).toBe(true);
  });

  it('does not mark any other failing status as no matches', () => {
    for (const status of [400, 408, 429, 500, 502, 504]) {
      expect(isNoMatches(new HttpError(status, 'Failure', 'https://countries.dev/name/zzz'))).toBe(false);
    }
  });

  it('never treats a cancellation or a timeout as no matches', () => {
    expect(isNoMatches(abortError())).toBe(false);
    expect(isNoMatches(timeoutError())).toBe(false);
    expect(isNoMatches(new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('cancellation and timeout are two different branches', () => {
  it('recognises AbortError', () => {
    expect(isAbortError(abortError())).toBe(true);
    expect(isTimeoutError(abortError())).toBe(false);
  });

  it('recognises TimeoutError separately from AbortError', () => {
    expect(isTimeoutError(timeoutError())).toBe(true);
    expect(isAbortError(timeoutError())).toBe(false);
  });
});

describe('classifyFailure', () => {
  it('classifies a self cancellation as aborted', () => {
    expect(classifyFailure(abortError())).toBe('aborted');
  });

  it('classifies a timeout as timeout', () => {
    expect(classifyFailure(timeoutError())).toBe('timeout');
  });

  it('prefers the abort reason over the thrown AbortError when the timeout is the real cause', () => {
    const controller = new AbortController();
    controller.abort(timeoutError());

    expect(classifyFailure(abortError(), controller.signal)).toBe('timeout');
  });

  it('classifies an aborted signal whose reason is a plain cancellation as aborted', () => {
    const controller = new AbortController();
    controller.abort();

    expect(classifyFailure(controller.signal.reason as unknown, controller.signal)).toBe('aborted');
  });

  it('classifies a failing HTTP status as http', () => {
    expect(classifyFailure(new HttpError(500, 'Server Error', 'https://countries.dev/name/spain'))).toBe('http');
  });

  it('classifies a network failure as network', () => {
    expect(classifyFailure(new TypeError('Failed to fetch'))).toBe('network');
  });

  it('classifies a malformed payload as invalid-response', () => {
    expect(classifyFailure(new SyntaxError('Unexpected token < in JSON'))).toBe('invalid-response');
  });

  it('classifies anything unexpected as unknown', () => {
    expect(classifyFailure('not an error')).toBe('unknown');
    expect(classifyFailure(null)).toBe('unknown');
    expect(classifyFailure(undefined)).toBe('unknown');
  });
});
