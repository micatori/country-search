import type { RawCountry } from './types.ts';

export const API_BASE_URL = 'https://countries.dev';
export const DEFAULT_TIMEOUT_MS = 8_000;

export interface SearchOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

export function buildSearchUrl(query: string, baseUrl: string = API_BASE_URL): string {
  throw new Error(`buildSearchUrl is not implemented yet (${query}, ${baseUrl})`);
}

export async function searchCountries(
  query: string,
  signal?: AbortSignal,
  options: SearchOptions = {},
): Promise<RawCountry[]> {
  throw new Error(`searchCountries is not implemented yet (${query}, ${String(signal)}, ${JSON.stringify(options)})`);
}
