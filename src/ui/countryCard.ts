import type { CountryView } from '../core/mapping.ts';
import { createElement, toggleHidden } from './dom.ts';

/**
 * Flags from countries.dev keep a fixed 3:2 ratio, so width/height are declared to reserve the
 * space before the image loads — otherwise every re-render shifts the list (layout shift).
 */
const FLAG_WIDTH = 60;
const FLAG_HEIGHT = 40;

const POPULATION_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** A shared formatter instance instead of one per card: 60 cards, one lookup table. */
export function formatPopulation(population: number): string {
  return population > 0 ? POPULATION_FORMATTER.format(population) : '—';
}

/**
 * A card is re-created on every state change, so node → data has to survive that churn.
 * A WeakMap keyed by the element does it without serializing the whole country into a data-*
 * attribute and without keeping detached nodes alive.
 */
const viewByCard = new WeakMap<Element, CountryView>();

/**
 * An empty or broken flag degrades to a text placeholder instead of the browser's broken-image
 * icon. No innerHTML anywhere: the placeholder is a real element, so a country name can never be
 * parsed as markup.
 */
export function createFlagBox(country: CountryView): HTMLElement {
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

/** Rows with a missing value are dropped instead of rendering "Capital: " with an empty tail. */
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
  const card = createElement('li', {
    class: 'card card--selectable',
    dataset: { countryId: country.id },
    attributes: {
      tabindex: '0',
      role: 'button',
      'aria-expanded': 'false',
      'aria-label': `Show details for ${country.name}`,
    },
    children: [
      createFlagBox(country),
      createElement('div', {
        class: 'card__body',
        children: [createElement('h3', { class: 'card__name', text: country.name }), buildRows(country)],
      }),
    ],
  });

  viewByCard.set(card, country);
  return card;
}

/**
 * The whole list is rebuilt on every state change. That is cheaper to reason about than a manual
 * diff and cannot keep a card of a previous query — the property the whole task is about.
 * Listeners die together with removed nodes, so rebuilding leaks nothing.
 */
export function renderCountryList(container: ParentNode, countries: readonly CountryView[]): void {
  container.replaceChildren(...countries.map(createCountryCard));
}

/** Delegation, not per-card listeners: the list is rebuilt constantly, the handlers are not. */
function findCard(target: EventTarget | null): HTMLLIElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const card = target.closest('li.card--selectable');
  if (card === null || !viewByCard.has(card)) {
    return null;
  }

  return card as HTMLLIElement;
}

function findSelection(event: Event): { readonly country: CountryView; readonly card: HTMLLIElement } | undefined {
  const card = findCard(event.target);
  const country = card === null ? undefined : viewByCard.get(card);

  return card !== undefined && card !== null && country !== undefined ? { country, card } : undefined;
}

export function attachCardActivation(
  container: HTMLElement,
  onSelect: (country: CountryView, trigger: HTMLElement) => void,
): void {
  container.addEventListener('click', (event: MouseEvent) => {
    const selection = findSelection(event);
    if (selection !== undefined) {
      onSelect(selection.country, selection.card);
    }
  });

  container.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    const selection = findSelection(event);
    if (selection === undefined) {
      return;
    }
    event.preventDefault(); // Space would otherwise scroll the page
    onSelect(selection.country, selection.card);
  });
}
