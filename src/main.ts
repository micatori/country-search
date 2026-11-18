import { createSearchController } from './core/searchController.ts';
import type { SearchState } from './core/searchController.ts';
import { mountShell } from './ui/shell.ts';
import { toggleHidden } from './ui/dom.ts';

const shell = mountShell();

const controller = createSearchController({
  onStateChange: (state) => {
    renderStatus(state);
  },
});

function renderStatus(state: SearchState): void {
  const trimmedQuery = state.query.trim();

  shell.searchInput.setAttribute('aria-busy', state.status === 'loading' ? 'true' : 'false');
  toggleHidden(shell.clearButton, trimmedQuery === '');
  shell.status.textContent = describeState(state);
}

function describeState(state: SearchState): string {
  if (state.query.trim() === '') {
    return 'Start typing a country name';
  }

  switch (state.status) {
    case 'loading':
      return 'Searching…';
    case 'error':
      return 'Search failed';
    case 'empty':
      return 'No countries found';
    default: {
      const count = state.results.length;
      return `${count} ${count === 1 ? 'result' : 'results'}`;
    }
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

renderStatus(controller.state);
