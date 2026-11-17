import type { RawCountry } from './types.ts';

export interface CurrencyView {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
}

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
  throw new Error(
    `mapCountryResponse is not implemented yet (name ${String(raw.name)}, locale ${String(options.locale)})`,
  );
}

export function mapCountryResponses(payload: readonly unknown[]): CountryView[] {
  throw new Error(`mapCountryResponses is not implemented yet (${payload.length} entries)`);
}
