import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createSearchController } from '../../src/core/searchController.ts';
import type { SearchController, SearchState } from '../../src/core/searchController.ts';

type FetchStub = (input: string, init?: RequestInit) => Promise<Response>;

interface DeferredRequest {
  readonly query: string;
  readonly signal: AbortSignal | null;
  /** 'aborted' only when the signal cancelled it, 'failed' for a manually injected error. */
  outcome: 'pending' | 'resolved' | 'aborted' | 'failed';
  resolve: (name: string) => void;
  reject: (reason: unknown) => void;
}

/**
 * Abort-aware fetch stub. Whichever of resolve()/abort()/reject() comes first wins, and the
 * first one settles the outcome for good — as a real fetch does. abort() before the response
 * settles rejects with the signal reason, which is exactly what lets these tests tell a real
 * cancellation apart from an implementation that merely ignores stale responses behind a flag.
 */
function createDeferredFetch(): { fetchMock: Mock<FetchStub>; requests: DeferredRequest[] } {
  const requests: DeferredRequest[] = [];

  const fetchMock = vi.fn<FetchStub>((url: string, init?: RequestInit) => {
    const segments = url.split('/name/');
    const query = decodeURIComponent(segments[1] ?? '');
    const signal = init?.signal ?? null;

    const request: DeferredRequest = {
      query,
      signal,
      outcome: 'pending',
      resolve: () => undefined,
      reject: () => undefined,
    };

    const body = new Promise<Response>((resolve, reject) => {
      const settle = (next: 'aborted' | 'failed', reason: unknown): void => {
        if (request.outcome !== 'pending') {
          return;
        }
        request.outcome = next;
        reject(reason);
      };

      request.resolve = (name: string) => {
        if (request.outcome !== 'pending') {
          return;
        }
        request.outcome = 'resolved';
        resolve(
          new Response(JSON.stringify([{ name, alpha2Code: name.slice(0, 2).toUpperCase() }]), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        );
      };
      request.reject = (reason: unknown) => settle('failed', reason);

      const onAbort = (): void => settle('aborted', signal?.reason);
      if (signal?.aborted) {
        onAbort();
      } else {
        signal?.addEventListener('abort', onAbort, { once: true });
      }
    });

    requests.push(request);
    return body;
  });

  return { fetchMock, requests };
}

/** Flushes microtasks only — safe under fake timers. */
async function flushMicrotasks(): Promise<void> {
  for (let step = 0; step < 20; step += 1) {
    await Promise.resolve();
  }
}

/** One real macrotask, so a debounce timer scheduled earlier fires first. */
const nextMacrotask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const namesOf = (state: SearchState | undefined): readonly string[] =>
  (state?.results ?? []).map((country) => country.name);

const DEBOUNCE_NEVER_FIRES_MS = 250;
/** Larger than every timer these tests advance, so the timeout branch stays dormant here. */
const TIMEOUT_FAR_OUT_MS = 600_000;

let fetchMock: Mock<FetchStub>;
let requests: DeferredRequest[];
let published: SearchState[];

function makeController(debounceMs: number): SearchController {
  return createSearchController({
    debounceMs,
    // its only job in this file is to prove the timeout signal is merged into the very same
    // AbortSignal that the caller cancels
    timeoutMs: TIMEOUT_FAR_OUT_MS,
    onStateChange: (state) => {
      published.push({ ...state });
    },
  });
}

beforeEach(() => {
  const deferred = createDeferredFetch();
  fetchMock = deferred.fetchMock;
  requests = deferred.requests;
  published = [];
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('race: resolve order inverted against request order', () => {
  it('renders only the last query when an older response would arrive later', async () => {
    const controller = makeController(0);

    controller.handleInput('sp');
    await nextMacrotask();
    controller.handleInput('spa');
    await nextMacrotask();
    controller.handleInput('spain');
    await nextMacrotask();

    expect(requests.map((request) => request.query)).toEqual(['sp', 'spa', 'spain']);

    // the newest response lands first
    requests[2]?.resolve('Spain');
    await flushMicrotasks();

    expect(controller.state.status).toBe('success');
    expect(namesOf(controller.state)).toEqual(['Spain']);
    expect(controller.state.failure).toBeNull();

    // ...and only afterwards the test tries to deliver the older responses
    requests[0]?.resolve('Spain-ish');
    requests[1]?.resolve('Spatial');
    await flushMicrotasks();

    // real cancellation, not post-factum filtering: the older requests were already aborted
    expect(requests[0]?.outcome).toBe('aborted');
    expect(requests[1]?.outcome).toBe('aborted');
    expect(requests[2]?.outcome).toBe('resolved');
    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(requests[1]?.signal?.aborted).toBe(true);

    expect(namesOf(controller.state)).toEqual(['Spain']);
    const everyPublishedName = published.flatMap((state) => namesOf(state));
    expect(everyPublishedName).not.toContain('Spatial');
    expect(everyPublishedName).not.toContain('Spain-ish');
  });

  it('still drops a stale response that was already resolved before the cancellation', async () => {
    const controller = makeController(0);

    controller.handleInput('sp');
    await nextMacrotask();
    expect(requests).toHaveLength(1);

    // the response wins the race: it is handed over before the user types on
    requests[0]?.resolve('Spain-ish');

    // ...and the keystroke arrives in the same tick, before the .then continuation runs
    controller.handleInput('spain');
    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(requests[0]?.outcome).toBe('resolved');

    await flushMicrotasks();

    expect(namesOf(controller.state)).not.toContain('Spain-ish');
    expect(published.flatMap((state) => namesOf(state))).not.toContain('Spain-ish');
  });
});

describe('race: cancellation happens on every keystroke, not when debounce fires', () => {
  it('aborts the in-flight request synchronously while the debounce timer is still pending', () => {
    vi.useFakeTimers();
    const controller = makeController(DEBOUNCE_NEVER_FIRES_MS);

    controller.handleInput('sp');
    vi.advanceTimersByTime(DEBOUNCE_NEVER_FIRES_MS);

    // request for 'sp' is in flight and nobody has cancelled it yet
    expect(requests).toHaveLength(1);
    expect(requests[0]?.signal?.aborted).toBe(false);

    controller.handleInput('spain');

    // synchronously — long before the debounce timer of the new query would run
    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(requests[0]?.outcome).toBe('aborted');
    expect(requests).toHaveLength(1);
  });

  it('aborts the in-flight request and schedules nothing when the field becomes empty', () => {
    vi.useFakeTimers();
    const controller = makeController(DEBOUNCE_NEVER_FIRES_MS);

    controller.handleInput('spain');
    vi.advanceTimersByTime(DEBOUNCE_NEVER_FIRES_MS);
    expect(requests).toHaveLength(1);

    controller.handleInput('');

    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(controller.state.status).toBe('idle');
    expect(controller.state.results).toEqual([]);

    vi.advanceTimersByTime(5_000);
    expect(requests).toHaveLength(1);
  });
});

describe('race: cancellations and real failures are separated for the UI', () => {
  it('never publishes an error state for self cancellations', async () => {
    const controller = makeController(0);

    controller.handleInput('sp');
    await nextMacrotask();
    controller.handleInput('spain');
    await nextMacrotask();
    controller.handleInput('spainish');
    await nextMacrotask();

    requests.at(-1)?.resolve('Spain');
    await flushMicrotasks();

    expect(published.some((state) => state.status === 'error')).toBe(false);
    expect(published.some((state) => state.failure !== null)).toBe(false);
    expect(controller.state.status).toBe('success');
    expect(namesOf(controller.state)).toEqual(['Spain']);
  });

  it('retry re-issues exactly the last typed query after a real failure', async () => {
    const controller = makeController(0);

    controller.handleInput('sp');
    await nextMacrotask();
    controller.handleInput('spain');
    await nextMacrotask();
    expect(requests.map((request) => request.query)).toEqual(['sp', 'spain']);

    requests[1]?.reject(new TypeError('Failed to fetch'));
    await flushMicrotasks();

    expect(requests[1]?.outcome).toBe('failed');
    expect(controller.state.status).toBe('error');
    expect(controller.state.failure?.kind).toBe('network');

    controller.retry();
    await flushMicrotasks();

    expect(requests).toHaveLength(3);
    expect(requests[2]?.query).toBe('spain');

    // that request had already settled, so there was nothing left to cancel: retry starts a
    // brand new request instead of reviving a dead controller
    expect(requests[1]?.signal?.aborted).toBe(false);
    expect(requests[2]?.signal?.aborted).toBe(false);

    expect(controller.state.status).toBe('loading');
    expect(controller.state.failure).toBeNull();
  });

  it('retry cancels a request that is still in flight', async () => {
    const controller = makeController(0);

    controller.handleInput('spain');
    await nextMacrotask();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.signal?.aborted).toBe(false);

    controller.retry();
    await flushMicrotasks();

    expect(requests).toHaveLength(2);
    expect(requests[0]?.outcome).toBe('aborted');
    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(requests[1]?.query).toBe('spain');
    expect(controller.state.status).toBe('loading');
  });
});
