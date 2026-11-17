export interface RawCurrency {
  readonly code?: string;
  readonly name?: string;
  readonly symbol?: string;
}

export interface RawLanguage {
  readonly iso639_1?: string;
  readonly iso639_2?: string;
  readonly name?: string;
}

export interface RawCountry {
  readonly name: string | { common?: string; official?: string };
  readonly capital?: string | string[];
  readonly region?: string;
  readonly subregion?: string;
  readonly population?: number;
  readonly area?: number;
  readonly languages?: RawLanguage[];
  readonly currencies?: RawCurrency[];
  readonly borders?: string[];
  readonly callingCodes?: string[];
  readonly flags?: { readonly svg?: string; readonly png?: string } | string;
  readonly flag?: string;
  readonly alpha2Code?: string;
  readonly alpha3Code?: string;
  readonly translations?: Record<string, { readonly name?: string }>;
  readonly [key: string]: unknown;
}
