import type { CountryView } from '../core/mapping.ts';
import { createElement, toggleHidden } from './dom.ts';

const FLAG_WIDTH = 60;
const FLAG_HEIGHT = 40;

const POPULATION_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

export function formatPopulation(population: number): string {
  return population > 0 ? POPULATION_FORMATTER.format(population) : '—';
}

function buildFlag(country: CountryView): HTMLElement {
  const fallback = createElement('span', {
    class: 'card__flag-fallback',
    text: country.alpha2Code !== '' ? country.alpha2Code : '⚑',
    attributes: { 'aria-hidden': 'true' },
  });

  if (country.flagUrl === '') {
    return createElement('div', { class: 'card__flag-box', children: [fallback] });
  }

  const image = createElement('img', {
    class: 'card__flag',
    attributes: {
      src: country.flagUrl,
      alt: `${country.name} flag`,
      width: String(FLAG_WIDTH),
      height: String(FLAG_HEIGHT),
      loading: 'lazy',
      decoding: 'async',
    },
  });

  image.addEventListener('error', () => {
    toggleHidden(image, true);
    fallback.hidden = false;
  });

  return createElement('div', { class: 'card__flag-box', children: [image, fallback] });
}

interface MetaRow {
  readonly label: string;
  readonly value: string;
}

function buildRows(country: CountryView): HTMLElement {
  const rows: readonly MetaRow[] = [
    { label: 'Capital', value: country.capital },
    { label: 'Region', value: country.region },
    { label: 'Population', value: formatPopulation(country.population) },
  ];

  const nodes = rows
    .filter((row) => row.value !== '')
    .map((row) =>
      createElement('div', {
        class: 'card__row',
        children: [
          createElement('span', { class: 'card__label', text: row.label }),
          createElement('span', { class: 'card__value', text: row.value }),
        ],
      }),
    );

  return createElement('dl', { class: 'card__rows', children: nodes });
}

export function createCountryCard(country: CountryView): HTMLLIElement {
  const body = createElement('div', {
    class: 'card__body',
    children: [createElement('h3', { class: 'card__name', text: country.name }), buildRows(country)],
  });

  return createElement('li', {
    class: 'card',
    dataset: { countryId: country.id },
    children: [buildFlag(country), body],
  });
}

export function renderCountryList(container: ParentNode, countries: readonly CountryView[]): void {
  container.replaceChildren(...countries.map(createCountryCard));
}
