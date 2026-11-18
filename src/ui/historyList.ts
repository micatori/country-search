import { createElement, replaceContent } from './dom.ts';

export const HISTORY_ITEM_SELECTOR = 'button[data-query]';

/**
 * History items are real <button> elements, so Enter/Space work without any keydown handler —
 * unlike the result cards, which had to be made keyboard-operable by hand.
 */
function createHistoryItem(query: string): HTMLLIElement {
  const button = createElement('button', {
    class: 'history__chip',
    text: query,
    dataset: { query },
    attributes: {
      type: 'button',
      title: query,
      'aria-label': `Search again for ${query}`,
    },
  });

  return createElement('li', { class: 'history__item', children: [button] });
}

export function renderHistoryList(container: ParentNode, queries: readonly string[]): void {
  replaceContent(container, queries.map(createHistoryItem));
}

/** Delegation: the list is rebuilt whenever the history changes, the handler is attached once. */
export function attachHistoryActivation(container: HTMLElement, onSelect: (query: string) => void): void {
  container.addEventListener('click', (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    // closest() returns a bare Element; the type argument says which element the selector matches
    const button = target.closest<HTMLButtonElement>(HISTORY_ITEM_SELECTOR);
    const query = button?.dataset.query;

    if (query === undefined || query === '') {
      return;
    }

    onSelect(query);
  });
}
