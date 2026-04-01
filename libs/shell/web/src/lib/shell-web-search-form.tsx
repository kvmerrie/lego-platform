'use client';

import {
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from 'react';
import { listCatalogSearchSuggestions } from '@lego-platform/catalog/data-access';
import {
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { Icon, VisuallyHidden } from '@lego-platform/shared/ui';
import styles from './shell-web.module.css';
import {
  createRecentSearchQueryEntry,
  createRecentSearchSetEntry,
  type ShellWebRecentSearchEntry,
  mergeRecentSearches,
  normalizeRecentSearchQuery,
  readRecentSearches,
  removeRecentSearch,
  removeRecentSearchEntry,
  writeRecentSearch,
} from './shell-web-search-storage';
import { getNextSearchActiveIndex } from './shell-web-search-navigation';

function buildSearchHref(query: string): string {
  const searchParams = new URLSearchParams({
    q: normalizeRecentSearchQuery(query),
  });

  return `${buildWebPath(webPathnames.search)}?${searchParams.toString()}`;
}

export function ShellWebSearchForm({
  className,
  inputId,
  query,
}: {
  className?: string;
  inputId: string;
  query?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<
    ShellWebRecentSearchEntry[]
  >([]);
  const [searchValue, setSearchValue] = useState(query ?? '');

  useEffect(() => {
    setSearchValue(query ?? '');
  }, [query]);

  useEffect(() => {
    try {
      setRecentSearches(readRecentSearches(window.localStorage));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  const normalizedSearchValue = normalizeRecentSearchQuery(searchValue);
  const searchSuggestions = normalizedSearchValue
    ? listCatalogSearchSuggestions(normalizedSearchValue, 6)
    : [];
  const searchResultsHref = normalizedSearchValue
    ? buildSearchHref(normalizedSearchValue)
    : undefined;
  const showRecentSearches =
    isOpen && !normalizedSearchValue && Boolean(recentSearches.length);
  const showSuggestionPanel = isOpen && Boolean(normalizedSearchValue);
  const shouldRenderPanel = showRecentSearches || showSuggestionPanel;
  const searchResultEntry = normalizedSearchValue
    ? createRecentSearchQueryEntry(normalizedSearchValue)
    : undefined;
  const searchSuggestionPanelItems = showSuggestionPanel
    ? searchSuggestions.flatMap((searchSuggestion) => {
        const href = buildSetDetailPath(searchSuggestion.slug);
        const recentSearchEntry = createRecentSearchSetEntry({
          href,
          label: searchSuggestion.name,
          meta: `Set ${searchSuggestion.id} · ${searchSuggestion.theme}`,
        });

        return recentSearchEntry ? [{ href, recentSearchEntry }] : [];
      })
    : [];
  const panelItems = [
    ...(showRecentSearches
      ? recentSearches.map((recentSearchEntry) => ({
          href:
            recentSearchEntry.kind === 'set'
              ? recentSearchEntry.href
              : buildSearchHref(recentSearchEntry.query),
          recentSearchEntry,
        }))
      : []),
    ...searchSuggestionPanelItems,
    ...(showSuggestionPanel && searchResultsHref && searchResultEntry
      ? [
          {
            href: searchResultsHref,
            recentSearchEntry: searchResultEntry,
          },
        ]
      : []),
  ];

  useEffect(() => {
    setActiveItemIndex(-1);
  }, [isOpen, normalizedSearchValue, recentSearches.length]);

  function persistRecentSearch(recentSearchEntry?: ShellWebRecentSearchEntry) {
    if (!recentSearchEntry) {
      return;
    }

    try {
      setRecentSearches(
        writeRecentSearch(window.localStorage, recentSearchEntry),
      );
    } catch {
      setRecentSearches((existingRecentSearches) =>
        mergeRecentSearches(existingRecentSearches, recentSearchEntry),
      );
    }
  }

  function handleRemoveRecentSearch(
    recentSearchEntry: ShellWebRecentSearchEntry,
  ) {
    try {
      setRecentSearches(
        removeRecentSearch(window.localStorage, recentSearchEntry),
      );
    } catch {
      setRecentSearches((existingRecentSearches) =>
        removeRecentSearchEntry(existingRecentSearches, recentSearchEntry),
      );
    }
  }

  function handleSubmit(_event: FormEvent<HTMLFormElement>) {
    persistRecentSearch(createRecentSearchQueryEntry(searchValue));
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveItemIndex(-1);
      setIsOpen(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const navigationKey: 'ArrowDown' | 'ArrowUp' | 'Escape' | undefined =
      event.key === 'ArrowDown'
        ? 'ArrowDown'
        : event.key === 'ArrowUp'
          ? 'ArrowUp'
          : event.key === 'Escape'
            ? 'Escape'
            : undefined;

    if (navigationKey) {
      event.preventDefault();
      setIsOpen(navigationKey === 'Escape' ? false : true);
      setActiveItemIndex((currentActiveItemIndex) =>
        getNextSearchActiveIndex({
          activeIndex: currentActiveItemIndex,
          itemCount: panelItems.length,
          key: navigationKey,
        }),
      );
      return;
    }

    if (event.key === 'Enter' && activeItemIndex >= 0) {
      const activePanelItem = panelItems[activeItemIndex];

      if (!activePanelItem) {
        return;
      }

      event.preventDefault();
      persistRecentSearch(activePanelItem.recentSearchEntry);
      setIsOpen(false);
      window.location.assign(activePanelItem.href);
    }
  }

  return (
    <div
      className={className}
      onBlur={handleBlur}
      onFocus={() => setIsOpen(true)}
    >
      <form
        action={buildWebPath(webPathnames.search)}
        className={styles.searchForm}
        onSubmit={handleSubmit}
        role="search"
      >
        <label className={styles.searchLabel} htmlFor={inputId}>
          <VisuallyHidden>Search the catalog</VisuallyHidden>
        </label>
        <input
          autoComplete="off"
          className={styles.searchInput}
          enterKeyHint="search"
          id={inputId}
          name="q"
          onChange={(event) => {
            setActiveItemIndex(-1);
            setIsOpen(true);
            setSearchValue(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search sets or set number"
          type="search"
          value={searchValue}
        />
        <button className={styles.searchSubmit} type="submit">
          Search
        </button>
      </form>
      {shouldRenderPanel ? (
        <div className={styles.searchPanel}>
          {showRecentSearches ? (
            <section
              aria-label="Recent searches"
              className={styles.searchPanelSection}
            >
              <p className={styles.searchPanelHeading}>Recent searches</p>
              <ul className={styles.searchList}>
                {recentSearches.map((recentSearch, index) => (
                  <li key={`${recentSearch.kind}-${recentSearch.label}`}>
                    <div
                      className={styles.recentSearchItem}
                      data-active={
                        index === activeItemIndex ? 'true' : undefined
                      }
                    >
                      <a
                        className={styles.recentSearchLink}
                        href={
                          recentSearch.kind === 'set'
                            ? recentSearch.href
                            : buildSearchHref(recentSearch.query)
                        }
                        onClick={() => persistRecentSearch(recentSearch)}
                        onMouseEnter={() => setActiveItemIndex(index)}
                      >
                        <span className={styles.recentSearchLabel}>
                          {recentSearch.label}
                        </span>
                        {recentSearch.kind === 'set' ? (
                          <span className={styles.recentSearchMeta}>
                            {recentSearch.meta}
                          </span>
                        ) : null}
                      </a>
                      <button
                        aria-label={`Remove recent search ${recentSearch.label}`}
                        className={styles.recentSearchRemove}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleRemoveRecentSearch(recentSearch);
                        }}
                        type="button"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {showSuggestionPanel ? (
            <section
              aria-label="Matching sets"
              className={styles.searchPanelSection}
            >
              {searchSuggestions.length ? (
                <>
                  <p className={styles.searchPanelHeading}>Matching sets</p>
                  <ul className={styles.searchList}>
                    {searchSuggestions.map((searchSuggestion, index) => {
                      const panelItemIndex = showRecentSearches
                        ? recentSearches.length + index
                        : index;
                      const suggestionPanelItem =
                        searchSuggestionPanelItems[index];

                      return (
                        <li key={searchSuggestion.id}>
                          <a
                            className={styles.searchSuggestionLink}
                            data-active={
                              panelItemIndex === activeItemIndex
                                ? 'true'
                                : undefined
                            }
                            href={buildSetDetailPath(searchSuggestion.slug)}
                            onClick={() =>
                              persistRecentSearch(
                                suggestionPanelItem?.recentSearchEntry,
                              )
                            }
                            onMouseEnter={() =>
                              setActiveItemIndex(panelItemIndex)
                            }
                          >
                            {searchSuggestion.imageUrl ? (
                              <img
                                alt=""
                                className={styles.searchSuggestionImage}
                                loading="lazy"
                                src={searchSuggestion.imageUrl}
                              />
                            ) : null}
                            <span className={styles.searchSuggestionContent}>
                              <span className={styles.searchSuggestionName}>
                                {searchSuggestion.name}
                              </span>
                              <span className={styles.searchSuggestionMeta}>
                                Set {searchSuggestion.id} ·{' '}
                                {searchSuggestion.theme}
                              </span>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className={styles.searchPanelHint}>
                  No matching sets yet. Open the full results page to keep
                  looking.
                </p>
              )}
              {searchResultsHref ? (
                <a
                  className={styles.searchResultsLink}
                  data-active={
                    panelItems.length - 1 === activeItemIndex
                      ? 'true'
                      : undefined
                  }
                  href={searchResultsHref}
                  onClick={() => persistRecentSearch(searchResultEntry)}
                  onMouseEnter={() => setActiveItemIndex(panelItems.length - 1)}
                >
                  See all results for "{normalizedSearchValue}"
                </a>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ShellWebSearchForm;
