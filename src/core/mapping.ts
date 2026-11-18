import { API_BASE_URL } from './api.ts';
import type { RawCountry } from './types.ts';

const DEFAULT_FLAG_BASE_URL = `${API_BASE_URL}/flags`;

export interface CurrencyView {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
}

/**
 * View model shared by the card and the detail panel: one pass produces everything the UI
 * renders, so opening the detail never re-maps. Only the *shape* is normalized here — human
 * formatting of numbers belongs to the UI layer, which keeps this function locale-independent
 * and therefore deterministic.
 */
export interface CountryView {
  readonly id: string;
  readonly name: string;
  readonly flagUrl: string;
  readonly capital: string;
  readonly region: string;
  readonly subregion: string;
  readonly population: number;
  readonly area: number;
  readonly languages: readonly string[];
  readonly currencies: readonly CurrencyView[];
  readonly borders: readonly string[];
  readonly callingCodes: readonly string[];
  readonly topLevelDomain: readonly string[];
  readonly alpha2Code: string;
  readonly alpha3Code: string;
}

export interface MappingOptions {
  readonly locale?: string;
  readonly flagBaseUrl?: string;
}

export function mapCountryResponse(raw: RawCountry, options: MappingOptions = {}): CountryView {
  const name = readName(raw, options.locale);

  return {
    id: readId(raw, name),
    name,
    flagUrl: readFlagUrl(raw, options.flagBaseUrl ?? DEFAULT_FLAG_BASE_URL),
    capital: readCapital(raw),
    region: toText(raw.region),
    subregion: toText(raw.subregion),
    population: readFiniteNumber(raw.population),
    area: readFiniteNumber(raw.area),
    languages: readLanguages(raw),
    currencies: readCurrencies(raw),
    borders: uniqueText(raw.borders ?? []),
    callingCodes: uniqueText(raw.callingCodes ?? []),
    topLevelDomain: uniqueText(raw.topLevelDomain ?? []),
    alpha2Code: toText(raw.alpha2Code).toUpperCase(),
    alpha3Code: toText(raw.alpha3Code).toUpperCase(),
  };
}

export function mapCountryResponses(payload: readonly unknown[]): CountryView[] {
  return payload.filter(isCountryLike).map((country) => mapCountryResponse(country));
}

/* Normalizing helpers. Each one is total: an unexpected value degrades into an empty value
   rather than throwing, because one broken country must not void the whole result list. */

const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function firstText(values: readonly unknown[]): string {
  for (const value of values) {
    const text = toText(value);
    if (text !== '') {
      return text;
    }
  }
  return '';
}

function uniqueText(values: readonly unknown[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const text = toText(value);
    if (text !== '') {
      unique.add(text);
    }
  }
  return [...unique];
}

const readFiniteNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

function isCountryLike(value: unknown): value is RawCountry {
  return typeof value === 'object' && value !== null && 'name' in value;
}

function readName(raw: RawCountry, locale: string | undefined): string {
  const nested = typeof raw.name === 'object' && raw.name !== null ? raw.name : undefined;
  const translated = locale === undefined ? '' : toText(raw.translations?.[locale]?.name);
  const flat = typeof raw.name === 'string' ? raw.name : undefined;

  return firstText([translated, nested?.common, nested?.official, flat]);
}

function readCapital(raw: RawCountry): string {
  const { capital } = raw;
  return Array.isArray(capital) ? firstText(capital) : toText(capital);
}

function readFlagUrl(raw: RawCountry, flagBaseUrl: string): string {
  const { flags } = raw;
  const nested = typeof flags === 'object' && flags !== null ? flags : undefined;

  const direct = firstText([typeof flags === 'string' ? flags : undefined, nested?.svg, nested?.png, raw.flag]);
  if (direct !== '') {
    return direct;
  }

  const alpha2 = toText(raw.alpha2Code);
  return alpha2 === '' ? '' : `${flagBaseUrl}/${alpha2.toLowerCase()}.svg`;
}

function readLanguages(raw: RawCountry): string[] {
  const names = (raw.languages ?? []).map((entry) =>
    typeof entry === 'string' ? entry : firstText([entry.name, entry.iso639_1, entry.iso639_2]),
  );

  return names.length > 0 ? uniqueText(names) : uniqueText(raw.langs ?? []);
}

function readCurrencies(raw: RawCountry): CurrencyView[] {
  return (raw.currencies ?? [])
    .map((entry) => ({
      code: firstText([entry.code, entry.name]),
      name: toText(entry.name),
      symbol: toText(entry.symbol),
    }))
    .filter((currency) => currency.code !== '');
}

function readId(raw: RawCountry, name: string): string {
  const alpha3 = toText(raw.alpha3Code).toUpperCase();
  if (alpha3 !== '') {
    return alpha3;
  }

  const alpha2 = toText(raw.alpha2Code).toUpperCase();
  if (alpha2 !== '') {
    return alpha2;
  }

  return name.toLowerCase().replace(/\s+/g, '-');
}
