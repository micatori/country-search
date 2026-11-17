import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debounce } from '../../src/core/debounce.ts';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not invoke the function before the delay elapses', () => {
    const spy = vi.fn((_query: string) => undefined);

    debounce(spy, 200)('sp');

    vi.advanceTimersByTime(199);
    expect(spy).not.toHaveBeenCalled();
  });

  it('invokes the function once after the delay elapses', () => {
    const spy = vi.fn((_query: string) => undefined);

    debounce(spy, 200)('spain');

    vi.advanceTimersByTime(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('spain');
  });

  it('restarts the timer when called again within the delay', () => {
    const spy = vi.fn((_query: string) => undefined);
    const debounced = debounce(spy, 200);

    debounced('sp');
    vi.advanceTimersByTime(150);
    debounced('spain');
    vi.advanceTimersByTime(150);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('spain');
  });

  it('keeps only the arguments of the last call in a burst', () => {
    const spy = vi.fn((_query: string) => undefined);
    const debounced = debounce(spy, 100);

    debounced('s');
    debounced('sp');
    debounced('spa');

    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('spa');
  });

  it('handles repeated bursts one after another', () => {
    const spy = vi.fn((_query: string) => undefined);
    const debounced = debounce(spy, 100);

    debounced('a');
    vi.advanceTimersByTime(100);
    debounced('b');
    vi.advanceTimersByTime(100);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 'a');
    expect(spy).toHaveBeenNthCalledWith(2, 'b');
  });

  it('never invokes the function after cancel()', () => {
    const spy = vi.fn((_query: string) => undefined);
    const debounced = debounce(spy, 100);

    debounced('spain');
    debounced.cancel();

    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
  });

  it('invokes the pending call immediately on flush() and does not repeat it', () => {
    const spy = vi.fn((_query: string) => undefined);
    const debounced = debounce(spy, 100);

    debounced('spain');
    debounced.flush();
    expect(spy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does nothing on flush() when no call is pending', () => {
    const spy = vi.fn((_query: string) => undefined);

    debounce(spy, 100).flush();
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps timers of different debounced functions independent', () => {
    const first = vi.fn((_query: string) => undefined);
    const second = vi.fn((_query: string) => undefined);

    debounce(first, 100)('first');
    debounce(second, 300)('second');

    vi.advanceTimersByTime(150);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('forwards all arguments of the last call', () => {
    const spy = vi.fn((_query: string, _sessionId: string) => undefined);

    debounce(spy, 50)('spain', 'session-1');
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledWith('spain', 'session-1');
  });
});
