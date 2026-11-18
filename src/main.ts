import { createSearchController } from './core/searchController.ts';
import type { SearchState } from './core/searchController.ts';
import { mountShell } from './ui/shell.ts';
import { buildSpinner, describeSearchState, renderSearchStatus } from './ui/searchStatus.ts';
import { toggleHidden } from './ui/dom.ts';

const shell = mountShell();

const controller = createSearchController({
  onStateChange: (state) => {
    render(state);
  },
});

function render(state: SearchState): void {
  renderStatus(state);
  // onRetry is a callback, so this module never needs the controller beyond wiring
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

render(controller.state);
