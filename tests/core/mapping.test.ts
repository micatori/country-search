import { describe, expect, it } from 'vitest';

import { mapCountryResponse, mapCountryResponses } from '../../src/core/mapping.ts';
import type { RawCountry } from '../../src/core/types.ts';

/**
 * countries.dev may send values the declared contract does not describe (population as a
 * string, capital as an array, languages as plain strings). rawOf keeps those cases writable
 * in tests without loosening any production type.
 */
const rawOf = (value: Record<string, unknown>): RawCountry => value as RawCountry;

/** The exact payload from the task statement, used as a fixture instead of a network call. */
const UNITED_STATES: RawCountry = {
  name: 'United States of America',
  alpha2Code: 'US',
  alpha3Code: 'USA',
  capital: 'Washington, D.C.',
  region: 'Americas',
  subregion: 'North America',
  population: 329_484_123,
  area: 9_372_610,
  currencies: [{ code: 'USD', name: 'United States dollar', symbol: '$' }],
  languages: [{ iso639_1: 'en', name: 'English' }],
  callingCodes: ['1'],
  topLevelDomain: ['.us'],
  borders: ['CAN', 'MEX'],
  flag: 'https://countries.dev/flags/us.svg',
};

describe('mapCountryResponse: fields for the card', () => {
  it('maps the documented API example into view data', () => {
    const view = mapCountryResponse(UNITED_STATES);

    expect(view.name).toBe('United States of America');
    expect(view.flagUrl).toBe('https://countries.dev/flags/us.svg');
    expect(view.capital).toBe('Washington, D.C.');
    expect(view.region).toBe('Americas');
    expect(view.population).toBe(329_484_123);
    expect(view.languages).toEqual(['English']);
  });

  it('keeps a stable id usable as a list key', () => {
    expect(mapCountryResponse(UNITED_STATES).id).toBe('USA');
  });

  it('prefers the nested common name over the official one', () => {
    const view = mapCountryResponse(rawOf({ name: { common: 'Spain', official: 'Kingdom of Spain' } }));

    expect(view.name).toBe('Spain');
  });

  it('falls back to the official name when there is no common one', () => {
    const view = mapCountryResponse(rawOf({ name: { official: 'Republic of Croatia' } }));

    expect(view.name).toBe('Republic of Croatia');
  });

  it('uses the requested translation when present and keeps the plain name otherwise', () => {
    const localized = rawOf({
      name: 'Germany',
      translations: { rus: { name: 'Германия' }, spa: { name: 'Alemania' } },
    });

    expect(mapCountryResponse(localized, { locale: 'rus' }).name).toBe('Германия');
    expect(mapCountryResponse(localized, { locale: 'fra' }).name).toBe('Germany');
    expect(mapCountryResponse(localized).name).toBe('Germany');
  });
});

describe('mapCountryResponse: defensive normalization', () => {
  it('takes the first entry when capital is an array', () => {
    expect(mapCountryResponse(rawOf({ name: 'X', capital: ['Astana', 'second'] })).capital).toBe('Astana');
  });

  it('returns empty values for missing capital, region, name and numbers', () => {
    const view = mapCountryResponse({});

    expect(view.name).toBe('');
    expect(view.capital).toBe('');
    expect(view.region).toBe('');
    expect(view.population).toBe(0);
    expect(view.area).toBe(0);
    expect(view.languages).toEqual([]);
    expect(view.currencies).toEqual([]);
  });

  it('ignores a population that is not a finite number instead of copying NaN into the view', () => {
    expect(mapCountryResponse(rawOf({ name: 'X', population: Number.NaN })).population).toBe(0);
    expect(mapCountryResponse(rawOf({ name: 'X', population: '123' })).population).toBe(0);
  });

  it('prefers flags.svg, then flags.png, then flag, then derives from alpha2Code', () => {
    expect(mapCountryResponse(rawOf({ name: 'X', flags: { svg: 'a.svg', png: 'b.png' } })).flagUrl).toBe('a.svg');
    expect(mapCountryResponse(rawOf({ name: 'X', flags: { png: 'b.png' } })).flagUrl).toBe('b.png');
    expect(mapCountryResponse(rawOf({ name: 'X', flag: 'c.svg' })).flagUrl).toBe('c.svg');
    expect(mapCountryResponse(rawOf({ name: 'X', alpha2Code: 'de' })).flagUrl).toBe(
      'https://countries.dev/flags/de.svg',
    );
    expect(mapCountryResponse(rawOf({ name: 'X' })).flagUrl).toBe('');
  });

  it('normalizes language objects, entries without a name, plain strings and the langs fallback', () => {
    const view = mapCountryResponse(
      rawOf({
        name: 'X',
        languages: [{ iso639_1: 'en', name: 'English' }, { iso639_1: 'de' }, 'Français'],
      }),
    );

    expect(view.languages).toEqual(['English', 'de', 'Français']);
    expect(mapCountryResponse(rawOf({ name: 'X', langs: ['es', 'ca'] })).languages).toEqual(['es', 'ca']);
  });

  it('deduplicates and drops blank values in list fields', () => {
    const view = mapCountryResponse(
      rawOf({
        name: 'X',
        languages: [{ name: 'English' }, { name: 'English' }, { name: '   ' }],
        borders: ['CAN', 'can', '', 'MEX'],
        callingCodes: ['1', '1'],
      }),
    );

    expect(view.languages).toEqual(['English']);
    expect(view.borders).toEqual(['CAN', 'can', 'MEX']);
    expect(view.callingCodes).toEqual(['1']);
  });
});

describe('mapCountryResponse: fields for the detail view', () => {
  it('exposes area, subregion, borders, currencies, calling codes and domains', () => {
    const view = mapCountryResponse(UNITED_STATES);

    expect(view.area).toBe(9_372_610);
    expect(view.subregion).toBe('North America');
    expect(view.borders).toEqual(['CAN', 'MEX']);
    expect(view.callingCodes).toEqual(['1']);
    expect(view.topLevelDomain).toEqual(['.us']);
    expect(view.currencies).toEqual([{ code: 'USD', name: 'United States dollar', symbol: '$' }]);
    expect(view.alpha2Code).toBe('US');
    expect(view.alpha3Code).toBe('USA');
  });

  it('maps a currency without a symbol to an empty symbol instead of undefined', () => {
    const view = mapCountryResponse(rawOf({ name: 'X', currencies: [{ code: 'EUR', name: 'Euro' }] }));

    expect(view.currencies).toEqual([{ code: 'EUR', name: 'Euro', symbol: '' }]);
  });
});

describe('mapCountryResponse: purity', () => {
  it('does not mutate the raw payload', () => {
    const clone: RawCountry = JSON.parse(JSON.stringify(UNITED_STATES));

    mapCountryResponse(clone);

    expect(clone).toEqual(UNITED_STATES);
  });

  it('returns equal views for equal input without sharing arrays between calls', () => {
    const first = mapCountryResponse(UNITED_STATES);
    const second = mapCountryResponse(UNITED_STATES);

    expect(first).toEqual(second);
    expect(first.languages).not.toBe(second.languages);
    expect(first.currencies).not.toBe(second.currencies);
    expect(first.borders).not.toBe(second.borders);
  });
});

describe('mapCountryResponses', () => {
  it('maps every country and skips entries that are not country-shaped', () => {
    const payload = [UNITED_STATES, null, 'nope', undefined, { name: 'Spain', alpha2Code: 'ES' }];

    const views = mapCountryResponses(payload);

    expect(views.map((view) => view.name)).toEqual(['United States of America', 'Spain']);
    expect(views.every((view) => view.id !== '')).toBe(true);
  });

  it('returns an empty array for an empty payload', () => {
    expect(mapCountryResponses([])).toEqual([]);
  });
});
