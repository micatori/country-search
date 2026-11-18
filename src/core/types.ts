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
  readonly name?: string | { readonly common?: string; readonly official?: string };
  readonly capital?: string | readonly string[];
  readonly region?: string;
  readonly subregion?: string;
  readonly population?: number;
  readonly area?: number;
  readonly languages?: readonly (RawLanguage | string)[];
  readonly langs?: readonly string[];
  readonly currencies?: readonly RawCurrency[];
  readonly borders?: readonly string[];
  readonly callingCodes?: readonly string[];
  readonly topLevelDomain?: readonly string[];
  readonly flags?: { readonly svg?: string; readonly png?: string } | string;
  readonly flag?: string;
  readonly alpha2Code?: string;
  readonly alpha3Code?: string;
  readonly translations?: Readonly<Record<string, { readonly name?: string }>>;
  readonly [key: string]: unknown;
}
