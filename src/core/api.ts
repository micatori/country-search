import { combineSignals, createTimeoutSignal } from './abort.ts';
import { HttpError, InvalidPayloadError, NO_MATCH_STATUS } from './errors.ts';
import type { RawCountry } from './types.ts';

export const API_BASE_URL = 'https://countries.dev';
export const DEFAULT_TIMEOUT_MS = 8_000;

export interface SearchOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

export function buildSearchUrl(query: string, baseUrl: string = API_BASE_URL): string {
  return new URL(`/name/${encodeURIComponent(query)}`, baseUrl).toString();
}

/**
 * Fetches countries matching `query`.
 * - `signal` cancels the request when the user keeps typing;
 * - a timeout signal is merged into it, so one fetch answers to both;
 * - 404 means "no matches" -> empty array; any other !ok -> HttpError.
 */
export async function searchCountries(
  query: string,
  signal?: AbortSignal,
  options: SearchOptions = {},
): Promise<RawCountry[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery === '') {
    return [];
  }

  const url = buildSearchUrl(trimmedQuery, options.baseUrl ?? API_BASE_URL);
  const activeSignal = combineSignals([signal, createTimeoutSignal(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)]);

  const response = await fetch(url, {
    method: 'GET',
    signal: activeSignal,
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    if (response.status === NO_MATCH_STATUS) {
      return [];
    }
    throw new HttpError(response.status, response.statusText, url);
  }

  if (response.status === 204) {
    return [];
  }

  return normalizeCountryList(await readJson(response, url), url);
}

async function readJson(response: Response, url: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (_cause) {
    throw new InvalidPayloadError(url);
  }
}

function normalizeCountryList(payload: unknown, url: string): RawCountry[] {
  if (Array.isArray(payload)) {
    return payload.filter(isCountryLike);
  }
  if (isCountryLike(payload)) {
    return [payload];
  }
  throw new InvalidPayloadError(url);
}

function isCountryLike(value: unknown): value is RawCountry {
  return typeof value === 'object' && value !== null && 'name' in value;
}
