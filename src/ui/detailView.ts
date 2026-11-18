import type { CountryView, CurrencyView } from '../core/mapping.ts';
import { clearContent, createElement, replaceContent } from './dom.ts';
import { createFlagBox, formatPopulation } from './countryCard.ts';

const AREA_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** A dash beats an empty row: the user learns the data is missing, not that the row vanished. */
const EMPTY_VALUE = '—';

function formatArea(area: number): string {
  return area > 0 ? `${AREA_FORMATTER.format(area)} km²` : EMPTY_VALUE;
}

function formatCurrency(currency: CurrencyView): string {
  return [currency.code, currency.name, currency.symbol].filter((part) => part !== '').join(' · ');
}

function buildRow(label: string, value: string): HTMLElement {
  return createElement('div', {
    class: 'detail__row',
    children: [
      createElement('dt', { class: 'detail__label', text: label }),
      createElement('dd', { class: 'detail__value', text: value === '' ? EMPTY_VALUE : value }),
    ],
  });
}

/** Borders, languages and currencies are chip lists rather than one long comma string. */
function buildChipRow(label: string, values: readonly string[]): HTMLElement {
  if (values.length === 0) {
    return buildRow(label, EMPTY_VALUE);
  }

  const chips = values.map((value) => createElement('li', { class: 'chip', text: value }));

  return createElement('div', {
    class: 'detail__row',
    children: [
      createElement('dt', { class: 'detail__label', text: label }),
      createElement('dd', {
        class: 'detail__value',
        children: [createElement('ul', { class: 'detail__chips', children: chips })],
      }),
    ],
  });
}

function buildDetailCard(country: CountryView, onClose: () => void): HTMLElement {
  const closeButton = createElement('button', {
    class: 'detail__close',
    text: 'Close',
    attributes: { type: 'button', 'aria-label': `Close details for ${country.name}` },
  });
  closeButton.addEventListener('click', onClose);

  const subtitle = [country.region, country.subregion].filter((part) => part !== '').join(' · ');

  return createElement('article', {
    class: 'detail__card',
    children: [
      createElement('header', {
        class: 'detail__head',
        children: [
          createFlagBox(country),
          createElement('div', {
            class: 'detail__titles',
            children: [
              createElement('h2', { class: 'detail__title', text: country.name }),
              ...(subtitle === '' ? [] : [createElement('p', { class: 'detail__subtitle', text: subtitle })]),
            ],
          }),
          closeButton,
        ],
      }),
      createElement('dl', {
        class: 'detail__grid',
        children: [
          buildRow('Capital', country.capital),
          buildRow('Population', formatPopulation(country.population)),
          buildRow('Area', formatArea(country.area)),
          buildChipRow('Languages', country.languages),
          buildChipRow('Currencies', country.currencies.map(formatCurrency)),
          buildChipRow('Borders', country.borders),
          buildRow('Calling code', country.callingCodes.length > 0 ? `+${country.callingCodes.join(', +')}` : ''),
          buildRow('Domain', country.topLevelDomain.join(', ')),
        ],
      }),
      createElement('p', { class: 'detail__source', text: 'Data from countries.dev' }),
    ],
  });
}

/**
 * Returns the close button so the caller can move focus into the detail when the user opened it
 * by keyboard. Not a modal dialog: live search keeps the field usable, so a user can start a new
 * query while the detail stays open.
 */
export function renderDetail(
  container: HTMLElement,
  country: CountryView | null,
  onClose: () => void,
): HTMLButtonElement | undefined {
  if (country === null) {
    container.hidden = true;
    clearContent(container);
    return undefined;
  }

  container.hidden = false;
  const card = buildDetailCard(country, onClose);
  replaceContent(container, [card]);

  const close = card.querySelector('button.detail__close');
  return close instanceof HTMLButtonElement ? close : undefined;
}
