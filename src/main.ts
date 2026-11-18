import { createSearchController } from './core/searchController.ts';
import type { SearchState } from './core/searchController.ts';
import type { CountryView } from './core/mapping.ts';
import { attachCardActivation, renderCountryList } from './ui/countryCard.ts';
import { renderDetail } from './ui/detailView.ts';
import { toggleHidden } from './ui/dom.ts';
import { buildSpinner, describeSearchState, renderSearchStatus } from './ui/searchStatus.ts';
import { mountShell } from './ui/shell.ts';

const shell = mountShell();

const controller = createSearchController({
  onStateChange: (state) => {
    render(state);
  },
});

/**
 * Selection is UI state, not search state: the controller knows about queries and responses, the
 * open detail belongs to the view. The detail never re-fetches — it renders the CountryView that
 * is already in memory.
 */
let selectedCountry: CountryView | null = null;
let selectionTrigger: HTMLElement | null = null;

function markExpanded(trigger: HTMLElement | null, expanded: boolean): void {
  trigger?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function render(state: SearchState): void {
  renderStatus(state);
  renderCountryList(shell.results, state.results);
  renderSelection(state);
  renderSearchStatus(shell.feedback, state, () => {
    controller.retry();
  });
}

function renderStatus(state: SearchState): void {
  const trimmedQuery = state.query.trim();
  const isLoading = state.status === 'loading';

  shell.searchInput.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  toggleHidden(shell.clearButton, trimmedQuery === '');
  toggleHidden(shell.resultsPanel, state.results.length === 0);

  // assigning textContent removes the previous children — including an earlier spinner —
  // so exactly one indicator can exist at a time
  shell.status.textContent = describeSearchState(state);
  if (isLoading) {
    shell.status.appendChild(buildSpinner());
  }
}

/**
 * A detail without a matching card would be a lie about the current results, so it is closed as
 * soon as its country is no longer in the list.
 */
function renderSelection(state: SearchState): void {
  const selected = selectedCountry;
  if (selected === null) {
    renderDetail(shell.detail, null, closeDetail);
    return;
  }

  const stillPresent = state.results.some((country) => country.id === selected.id);
  if (!stillPresent) {
    closeDetail();
    return;
  }

  renderDetail(shell.detail, selected, closeDetail);
}

function openDetail(country: CountryView, trigger: HTMLElement): void {
  if (selectedCountry?.id === country.id) {
    closeDetail(); // clicking the same card again acts as a toggle
    return;
  }

  markExpanded(selectionTrigger, false);
  selectedCountry = country;
  selectionTrigger = trigger;
  markExpanded(trigger, true);

  const closeButton = renderDetail(shell.detail, country, closeDetail);
  // moving focus into the panel keeps keyboard users oriented after pressing Enter on a card
  closeButton?.focus();
}

function closeDetail(): void {
  const previousTrigger = selectionTrigger;
  selectedCountry = null;
  selectionTrigger = null;

  markExpanded(previousTrigger, false);
  renderDetail(shell.detail, null, closeDetail);

  // the trigger only gets focus back while it is still on screen
  if (previousTrigger?.isConnected === true) {
    previousTrigger.focus();
  }
}

shell.searchInput.addEventListener('input', () => {
  controller.handleInput(shell.searchInput.value);
});

// Enter skips the debounce instead of making the user wait 250 ms for nothing
shell.form.addEventListener('submit', (event) => {
  event.preventDefault();
  controller.submit();
});

shell.clearButton.addEventListener('click', () => {
  shell.searchInput.value = '';
  controller.clear();
  shell.searchInput.focus();
});

attachCardActivation(shell.results, openDetail);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && selectedCountry !== null) {
    closeDetail();
  }
});

render(controller.state);
