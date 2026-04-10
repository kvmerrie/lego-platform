'use client';

import {
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { listCatalogSearchSuggestions } from '@lego-platform/catalog/data-access';
import {
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import { useRouter } from 'next/navigation';
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
import {
  clearSearchOverlayReturnState,
  readSearchOverlayReturnState,
} from './shell-web-search-overlay-return-state';
import { getNextSearchActiveIndex } from './shell-web-search-navigation';
import { openMobileSearchOverlayEventName } from './shell-web-search-overlay-events';

function buildSearchHref(query: string): string {
  const searchParams = new URLSearchParams({
    q: normalizeRecentSearchQuery(query),
  });

  return `${buildWebPath(webPathnames.search)}?${searchParams.toString()}`;
}

export function ShellWebSearchForm({
  autoFocus = false,
  className,
  closeFallbackHref,
  hideTrigger = false,
  inputId,
  openOnMount = false,
  query,
  variant = 'inline',
}: {
  autoFocus?: boolean;
  className?: string;
  closeFallbackHref?: string;
  hideTrigger?: boolean;
  inputId: string;
  openOnMount?: boolean;
  query?: string;
  variant?: 'inline' | 'mobile-overlay';
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<
    ShellWebRecentSearchEntry[]
  >([]);
  const [searchValue, setSearchValue] = useState(query ?? '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const wasMobileOverlayOpenRef = useRef(false);

  const isMobileOverlay = variant === 'mobile-overlay';

  useEffect(() => {
    setSearchValue(query ?? '');
  }, [query]);

  useEffect(() => {
    if (!autoFocus || isMobileOverlay) {
      return;
    }

    searchInputRef.current?.focus();
    setIsOpen(true);
  }, [autoFocus, isMobileOverlay]);

  useEffect(() => {
    if (!isMobileOverlay || !openOnMount) {
      return;
    }

    setIsOpen(true);
  }, [isMobileOverlay, openOnMount]);

  useEffect(() => {
    if (!isMobileOverlay || !hideTrigger || !openOnMount) {
      return;
    }

    function handleOpenMobileSearchOverlay() {
      setIsOpen(true);
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }

    window.addEventListener(
      openMobileSearchOverlayEventName,
      handleOpenMobileSearchOverlay,
    );

    return () => {
      window.removeEventListener(
        openMobileSearchOverlayEventName,
        handleOpenMobileSearchOverlay,
      );
    };
  }, [hideTrigger, isMobileOverlay, openOnMount]);

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

  useEffect(() => {
    if (!isMobileOverlay) {
      return;
    }

    if (isOpen) {
      wasMobileOverlayOpenRef.current = true;
      searchInputRef.current?.focus();
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }

    if (wasMobileOverlayOpenRef.current) {
      mobileTriggerRef.current?.focus();
      wasMobileOverlayOpenRef.current = false;
    }
  }, [isMobileOverlay, isOpen]);

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

  function clearOverlayReturnState() {
    if (typeof window === 'undefined') {
      return;
    }

    clearSearchOverlayReturnState(window.sessionStorage);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isMobileOverlay) {
      event.preventDefault();

      if (!normalizedSearchValue) {
        setIsOpen(true);
        searchInputRef.current?.focus();
        return;
      }

      persistRecentSearch(createRecentSearchQueryEntry(normalizedSearchValue));
      clearOverlayReturnState();
      setIsOpen(false);
      router.replace(buildSearchHref(normalizedSearchValue), {
        scroll: false,
      });
      return;
    }

    persistRecentSearch(createRecentSearchQueryEntry(searchValue));
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (isMobileOverlay) {
      return;
    }

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
      clearOverlayReturnState();
      setIsOpen(false);
      window.location.assign(activePanelItem.href);
      return;
    }

    if (isMobileOverlay && event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  function closeMobileOverlay() {
    setActiveItemIndex(-1);

    if (hideTrigger && openOnMount) {
      const returnState =
        typeof window === 'undefined'
          ? undefined
          : readSearchOverlayReturnState(window.sessionStorage);

      setIsOpen(false);

      if (returnState && window.history.length > 1) {
        router.back();
        return;
      }

      if (returnState?.href) {
        router.replace(returnState.href, {
          scroll: false,
        });
        return;
      }

      clearOverlayReturnState();

      if (closeFallbackHref) {
        router.replace(closeFallbackHref, {
          scroll: false,
        });
        return;
      }
    }

    setIsOpen(false);
  }

  const searchForm = (
    <form
      action={buildWebPath(webPathnames.search)}
      className={`${styles.searchForm}${
        isMobileOverlay ? ` ${styles.mobileSearchOverlayForm}` : ''
      }`}
      onSubmit={handleSubmit}
      role="search"
    >
      <label className={styles.searchLabel} htmlFor={inputId}>
        <VisuallyHidden>Doorzoek de catalogus</VisuallyHidden>
      </label>
      <span aria-hidden="true" className={styles.searchInputIcon}>
        <Icon name="search" size={15} />
      </span>
      <input
        autoComplete="off"
        autoFocus={autoFocus && !isMobileOverlay}
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
        placeholder="Zoek op set of setnummer"
        ref={searchInputRef}
        type="search"
        value={searchValue}
      />
    </form>
  );

  const searchPanel = shouldRenderPanel ? (
    <div
      className={`${styles.searchPanel} ${
        isMobileOverlay ? styles.searchPanelInline : ''
      }`}
    >
      {showRecentSearches ? (
        <section
          aria-label="Recente zoekopdrachten"
          className={styles.searchPanelSection}
        >
          <p className={styles.searchPanelHeading}>Recente zoekopdrachten</p>
          <ul className={styles.searchList}>
            {recentSearches.map((recentSearch, index) => (
              <li key={`${recentSearch.kind}-${recentSearch.label}`}>
                <div
                  className={styles.recentSearchItem}
                  data-active={index === activeItemIndex ? 'true' : undefined}
                >
                  <a
                    className={styles.recentSearchLink}
                    href={
                      recentSearch.kind === 'set'
                        ? recentSearch.href
                        : buildSearchHref(recentSearch.query)
                    }
                    onClick={() => {
                      persistRecentSearch(recentSearch);
                      clearOverlayReturnState();
                    }}
                    onMouseEnter={() => setActiveItemIndex(index)}
                  >
                    <span
                      className={`${styles.recentSearchLabel} ${
                        recentSearch.kind === 'set' ? 'notranslate' : ''
                      }`}
                      translate={recentSearch.kind === 'set' ? 'no' : undefined}
                    >
                      {recentSearch.label}
                    </span>
                    {recentSearch.kind === 'set' ? (
                      <span
                        className={`${styles.recentSearchMeta} notranslate`}
                        translate="no"
                      >
                        {recentSearch.meta}
                      </span>
                    ) : null}
                  </a>
                  <button
                    aria-label={`Verwijder recente zoekopdracht ${recentSearch.label}`}
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
          aria-label="Passende sets"
          className={styles.searchPanelSection}
        >
          {searchSuggestions.length ? (
            <>
              <p className={styles.searchPanelHeading}>Passende sets</p>
              <ul className={styles.searchList}>
                {searchSuggestions.map((searchSuggestion, index) => {
                  const panelItemIndex = showRecentSearches
                    ? recentSearches.length + index
                    : index;
                  const suggestionPanelItem = searchSuggestionPanelItems[index];

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
                        onClick={() => {
                          persistRecentSearch(
                            suggestionPanelItem?.recentSearchEntry,
                          );
                          clearOverlayReturnState();
                        }}
                        onMouseEnter={() => setActiveItemIndex(panelItemIndex)}
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
                          <span
                            className={`${styles.searchSuggestionName} notranslate`}
                            translate="no"
                          >
                            {searchSuggestion.name}
                          </span>
                          <span
                            className={`${styles.searchSuggestionMeta} notranslate`}
                            translate="no"
                          >
                            Set {searchSuggestion.id} · {searchSuggestion.theme}
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
              Nog geen passende sets. Open de volledige resultatenpagina om
              verder te zoeken.
            </p>
          )}
          {searchResultsHref ? (
            <a
              className={styles.searchResultsLink}
              data-active={
                panelItems.length - 1 === activeItemIndex ? 'true' : undefined
              }
              href={searchResultsHref}
              onClick={() => {
                persistRecentSearch(searchResultEntry);
                clearOverlayReturnState();
              }}
              onMouseEnter={() => setActiveItemIndex(panelItems.length - 1)}
            >
              Bekijk alle resultaten voor "{normalizedSearchValue}"
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  ) : null;

  if (isMobileOverlay) {
    return (
      <div className={className}>
        {!hideTrigger ? (
          <button
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-label="Open zoeken"
            className={styles.mobileSearchButton}
            onClick={() => setIsOpen(true)}
            ref={mobileTriggerRef}
            type="button"
          >
            <Icon name="search" size={18} />
          </button>
        ) : null}
        {isOpen ? (
          <div
            aria-label="Zoeken"
            aria-modal="true"
            className={styles.mobileSearchOverlay}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeMobileOverlay();
              }
            }}
            role="dialog"
          >
            <div className={styles.mobileSearchOverlayBar}>
              <div className={styles.mobileSearchOverlaySearch}>
                {searchForm}
              </div>
              <button
                aria-label="Zoeken sluiten"
                className={styles.mobileSearchClose}
                onClick={closeMobileOverlay}
                type="button"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className={styles.mobileSearchOverlayResults}>
              {searchPanel}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={
        className ? `${styles.searchShell} ${className}` : styles.searchShell
      }
      onBlur={handleBlur}
      onFocus={() => setIsOpen(true)}
    >
      {searchForm}
      {searchPanel}
    </div>
  );
}

export default ShellWebSearchForm;
