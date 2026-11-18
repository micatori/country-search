import type { SearchFailure, SearchState } from '../core/searchController.ts';
import type { FailureKind } from '../core/errors.ts';
import { createElement, replaceContent, clearContent } from './dom.ts';

/**
 * Single source of truth for how a controller state is described to the user. main.ts no longer
 * contains any copy, so wording stays consistent between the live status line and the feedback
 * block, and can be changed in one place.
 */

interface KindCopy {
  readonly title: string;
  readonly hint: string;
}

/**
 * "no matches" is intentionally absent here: an empty result is not a failure, so it gets its
 * own neutral block instead of a danger-styled one.
 */
const FAILURE_COPY: Readonly<Record<Exclude<FailureKind, 'aborted'>, KindCopy>> = {
  timeout: {
    title: 'The request took too long',
    hint: 'The server did not answer in time. Check your connection and try again.',
  },
  network: {
    title: 'No connection to the server',
    hint: 'countries.dev is unreachable — your network may be offline. You can retry right away.',
  },
  http: {
    title: 'The service is unavailable',
    hint: 'countries.dev returned an error. Retrying usually helps after a moment.',
  },
  'invalid-response': {
    title: 'The answer could not be read',
    hint: 'The server replied, but not with readable data. You can retry.',
  },
  unknown: {
    title: 'The search failed',
    hint: 'Something unexpected went wrong. You can retry the same query.',
  },
};

const EMPTY_HINT = 'Try a shorter name, or check the spelling — for example “spain”, “united”, “fran”.';

export function describeSearchState(state: SearchState): string {
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

/** Only a real failure offers a retry; a cancellation never reaches this code path at all. */
function failureCopy(failure: SearchFailure): KindCopy {
  return failure.kind === 'aborted' ? FAILURE_COPY.unknown : FAILURE_COPY[failure.kind];
}

function buildEmptyCard(query: string): HTMLElement {
  return createElement('div', {
    class: 'feedback__card feedback__card--empty',
    attributes: { role: 'status' },
    children: [
      createElement('p', { class: 'feedback__title', text: `No countries match “${query}”` }),
      createElement('p', { class: 'feedback__hint', text: EMPTY_HINT }),
    ],
  });
}

function buildErrorCard(failure: SearchFailure, onRetry: () => void): HTMLElement {
  const copy = failureCopy(failure);

  const retryButton = createElement('button', {
    class: 'feedback__retry',
    text: 'Try again',
    attributes: { type: 'button', 'aria-label': `Search again for ${failure.query}` },
  });
  retryButton.addEventListener('click', onRetry);

  return createElement('div', {
    class: 'feedback__card feedback__card--error',
    attributes: { role: 'alert' },
    children: [
      createElement('p', { class: 'feedback__title', text: copy.title }),
      createElement('p', { class: 'feedback__hint', text: copy.hint }),
      retryButton,
      createElement('details', {
        class: 'feedback__details',
        children: [
          createElement('summary', { text: 'Technical details' }),
          createElement('code', { class: 'feedback__code', text: failure.message }),
        ],
      }),
    ],
  });
}

/**
 * Idle, loading and success leave the feedback block empty — the results list and the spinner in
 * the status line already communicate those states, and an error/empty block must not linger
 * above fresh results.
 */
function buildFeedbackCard(state: SearchState, onRetry: () => void): HTMLElement | undefined {
  if (state.status === 'empty') {
    return buildEmptyCard(state.query.trim());
  }

  if (state.status === 'error' && state.failure !== null) {
    return buildErrorCard(state.failure, onRetry);
  }

  return undefined;
}

export function renderSearchStatus(container: HTMLElement, state: SearchState, onRetry: () => void): void {
  const card = buildFeedbackCard(state, onRetry);

  if (card === undefined) {
    clearContent(container);
    return;
  }

  replaceContent(container, [card]);
}

/** Spinner for the status line, kept here so all state visuals live in one module. */
export function buildSpinner(): HTMLElement {
  return createElement('span', {
    class: 'status__spinner',
    attributes: { 'aria-hidden': 'true' },
  });
}
