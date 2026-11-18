import { createElement, toggleHidden } from './dom.ts';

export const SEARCH_INPUT_ID = 'search-input';
export const SEARCH_RESULTS_ID = 'search-results';
export const SEARCH_STATUS_ID = 'search-status';
export const SEARCH_DETAIL_ID = 'search-detail';

/** Named nodes of the static skeleton. Every later UI module renders into one of these. */
export interface AppShell {
  readonly root: HTMLElement;
  readonly form: HTMLFormElement;
  readonly searchInput: HTMLInputElement;
  readonly clearButton: HTMLButtonElement;
  readonly status: HTMLElement;
  readonly feedback: HTMLElement;
  readonly detail: HTMLElement;
  readonly historyPanel: HTMLElement;
  readonly historyClearButton: HTMLButtonElement;
  readonly historyItems: HTMLUListElement;
  readonly resultsPanel: HTMLElement;
  readonly results: HTMLUListElement;
}

/**
 * Builds the skeleton once, at startup. Afterwards only the *contents* of these containers
 * change, so the search field never loses focus while results re-render — the single most
 * common reason a "live search" feels unusable.
 */
export function mountShell(mountPoint: HTMLElement = document.body): AppShell {
  const searchInput = createElement('input', {
    id: SEARCH_INPUT_ID,
    class: 'search__field',
    attributes: {
      type: 'search',
      name: 'query',
      placeholder: 'Type a country name — try “spain”',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-describedby': SEARCH_STATUS_ID,
      'aria-controls': SEARCH_RESULTS_ID,
    },
  });

  const clearButton = createElement('button', {
    class: 'search__clear',
    text: 'Clear',
    attributes: { type: 'button', 'aria-label': 'Clear the search field', hidden: '' },
  });

  const form = createElement('form', {
    class: 'search',
    attributes: { role: 'search', 'aria-label': 'Country search' },
    children: [searchInput, clearButton],
  });

  const status = createElement('output', {
    id: SEARCH_STATUS_ID,
    class: 'status',
    text: 'Start typing a country name',
    attributes: { 'aria-live': 'polite', for: SEARCH_INPUT_ID },
  });

  const feedback = createElement('div', { class: 'feedback' });

  const detail = createElement('section', {
    id: SEARCH_DETAIL_ID,
    class: 'detail app__panel',
    attributes: { 'aria-label': 'Country details', hidden: '' },
  });

  const historyClearButton = createElement('button', {
    class: 'history__clear',
    text: 'Clear',
    attributes: { type: 'button', 'aria-label': 'Clear the search history' },
  });

  const historyItems = createElement('ul', {
    class: 'history__items',
    attributes: { 'aria-label': 'Recent searches' },
  });

  const historyPanel = createElement('section', {
    class: 'app__panel history',
    attributes: { 'aria-label': 'Recent searches', hidden: '' },
    children: [
      createElement('div', {
        class: 'history__head',
        children: [createElement('h2', { class: 'history__title', text: 'Recent searches' }), historyClearButton],
      }),
      historyItems,
    ],
  });
  toggleHidden(historyPanel, true);

  const results = createElement('ul', {
    id: SEARCH_RESULTS_ID,
    class: 'results',
    attributes: { 'aria-live': 'polite', 'aria-label': 'Search results' },
  });

  const resultsPanel = createElement('section', { class: 'app__panel', children: [results] });
  toggleHidden(resultsPanel, true);

  const root = createElement('div', {
    class: 'app',
    children: [
      createElement('h1', { class: 'app__title', text: 'Country Search' }),
      createElement('p', {
        class: 'app__hint',
        text: 'Search as you type. Older answers are cancelled, so only the newest query is shown.',
      }),
      form,
      status,
      feedback,
      detail,
      resultsPanel,
      historyPanel,
    ],
  });

  mountPoint.replaceChildren(root);

  return {
    root,
    form,
    searchInput,
    clearButton,
    status,
    feedback,
    detail,
    historyPanel,
    historyClearButton,
    historyItems,
    resultsPanel,
    results,
  };
}
