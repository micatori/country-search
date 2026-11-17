import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { API_BASE_URL, DEFAULT_TIMEOUT_MS, buildSearchUrl, searchCountries } from '../../src/core/api.ts';
import { HttpError, classifyFailure, isTimeoutError } from '../../src/core/errors.ts';

type FetchStub = (input: string, init?: RequestInit) => Promise<Response>;

const spain = { name: 'Spain', capital: 'Madrid', region: 'Europe', population: 47_455_000 };

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * A fetch stub that honours the given AbortSignal: it rejects with the signal reason as soon
 * as abort() is called. Without this the suite could not tell a real cancellation apart from
 * an ignored response.
 */
function hangingFetch(onSignal?: (signal: AbortSignal | null) => void): Mock<FetchStub> {
  return vi.fn<FetchStub>((_input: string, init?: RequestInit) => {
    const signal = init?.signal ?? null;
    onSignal?.(signal);

    return new Promise<Response>((_resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
}

let fetchMock: Mock<FetchStub>;

beforeEach(() => {
  fetchMock = vi.fn<FetchStub>(async () => jsonResponse([spain]));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildSearchUrl', () => {
  it('targets the name endpoint of countries.dev', () => {
    expect(buildSearchUrl('spain')).toBe(`${API_BASE_URL}/name/spain`);
  });

  it('escapes spaces and reserved characters', () => {
    expect(buildSearchUrl('United Kingdom')).toBe(`${API_BASE_URL}/name/United%20Kingdom`);
    expect(buildSearchUrl('Côte d’Ivoire / X')).toBe(`${API_BASE_URL}/name/C%C3%B4te%20d%E2%80%99Ivoire%20%2F%20X`);
  });
});

describe('request shape', () => {
  it('requests the query with GET and a live AbortSignal', async () => {
    await searchCountries('spain', new AbortController().signal);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`${API_BASE_URL}/name/spain`);
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);
  });

  it('sends no network request at all for a blank query', async () => {
    expect(await searchCountries('')).toEqual([]);
    expect(await searchCountries('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims the query before calling the API', async () => {
    await searchCountries('  spain  ');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE_URL}/name/spain`);
  });

  it('merges the caller signal with a timeout signal so both can cancel one request', async () => {
    // An array, not `let seen: AbortSignal | null = null`: TS narrows the variable to null
    // because the assignment happens inside a callback it cannot see.
    const seenSignals: AbortSignal[] = [];
    fetchMock = hangingFetch((signal) => {
      if (signal !== null) {
        seenSignals.push(signal);
      }
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const pending = searchCountries('spain', controller.signal);
    controller.abort();

    const error = await pending.catch((caught: unknown) => caught);

    expect(classifyFailure(error, controller.signal)).toBe('aborted');
    expect(seenSignals).toHaveLength(1);
    expect(seenSignals.at(-1)?.aborted).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  it('leaves the caller signal untouched when only the timeout fires', async () => {
    fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const error = await searchCountries('spain', controller.signal, {
      timeoutMs: 5,
    }).catch((caught: unknown) => caught);

    expect(isTimeoutError(error)).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });
});

describe('results', () => {
  it('resolves with the parsed array of countries', async () => {
    fetchMock.mockResolvedValue(jsonResponse([spain, { name: 'Spain-ish' }]));

    const result = await searchCountries('sp');
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe('Spain');
  });

  it('normalizes a single country object into an array', async () => {
    fetchMock.mockResolvedValue(jsonResponse(spain));
    expect(await searchCountries('spain')).toEqual([spain]);
  });

  it('returns an empty list for an empty 204 body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await searchCountries('spain')).toEqual([]);
  });
});

describe('404 is an empty result, not an error', () => {
  it('resolves with [] and never reports a failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'no matches' }, 404));

    await expect(searchCountries('zzzz')).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('real failures', () => {
  it('checks response.ok and throws HttpError with the status on 500', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500));

    const error = await searchCountries('spain').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(500);
    expect(classifyFailure(error)).toBe('http');
  });

  it('throws HttpError on 429 and 502 as well', async () => {
    for (const status of [429, 502]) {
      fetchMock.mockResolvedValue(jsonResponse({}, status));
      await expect(searchCountries('spain')).rejects.toBeInstanceOf(HttpError);
    }
  });

  it('surfaces an unreachable network as a "network" failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await searchCountries('spain').catch((caught: unknown) => caught);
    expect(classifyFailure(error)).toBe('network');
  });

  it('rejects with TimeoutError when the response never arrives', async () => {
    fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const error = await searchCountries('spain', new AbortController().signal, {
      timeoutMs: 5,
    }).catch((caught: unknown) => caught);

    expect(isTimeoutError(error)).toBe(true);
    expect(classifyFailure(error)).toBe('timeout');
  });

  it('rejects a user cancellation as "aborted" rather than resolving it', async () => {
    fetchMock = hangingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const pending = searchCountries('spain', controller.signal);
    controller.abort();

    const error = await pending.catch((caught: unknown) => caught);
    expect(classifyFailure(error)).toBe('aborted');
  });

  it('reports a malformed payload as "invalid-response" instead of an empty list', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway error</html>', { status: 200 }));

    const error = await searchCountries('spain').catch((caught: unknown) => caught);
    expect(classifyFailure(error)).toBe('invalid-response');
  });

  it('exposes a positive default timeout', () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
