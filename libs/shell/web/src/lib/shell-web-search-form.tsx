'use client';

import {
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import {
  listCatalogSetCardSearchMatches,
  type CatalogHomepageSetCard,
  type CatalogThemeDirectoryItem,
} from '@lego-platform/catalog/util';
import {
  buildSetDetailPath,
  buildThemePath,
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
import {
  dispatchMobileSearchOverlayVisibilityEvent,
  openMobileSearchOverlayEventName,
} from './shell-web-search-overlay-events';

function buildSearchHref(query: string): string {
  const searchParams = new URLSearchParams({
    q: normalizeRecentSearchQuery(query),
  });

  return `${buildWebPath(webPathnames.search)}?${searchParams.toString()}`;
}

const searchSuggestionsApiPath = '/api/catalog/search-suggestions';
const focusableElementSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type InlineSearchCloseReason =
  | 'backdrop'
  | 'blur'
  | 'escape'
  | 'result-select'
  | 'tab-backward'
  | 'tab-forward';

interface ShellWebSearchSuggestionPayload {
  sets: CatalogHomepageSetCard[];
  themes: CatalogThemeDirectoryItem[];
}

let overlaySearchSuggestionSetCardsRequest:
  | Promise<ShellWebSearchSuggestionPayload>
  | undefined;

export function clearShellWebSearchSuggestionOverlaySetCardsCache() {
  overlaySearchSuggestionSetCardsRequest = undefined;
}

function isCatalogHomepageSetCard(
  value: unknown,
): value is CatalogHomepageSetCard {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CatalogHomepageSetCard>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.slug === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.theme === 'string' &&
    typeof candidate.releaseYear === 'number' &&
    typeof candidate.pieces === 'number'
  );
}

async function loadOverlaySearchSuggestionSetCards(): Promise<ShellWebSearchSuggestionPayload> {
  overlaySearchSuggestionSetCardsRequest ??= fetch(searchSuggestionsApiPath, {
    cache: 'no-store',
  })
    .then(async (response) => {
      if (!response.ok) {
        return {
          sets: [],
          themes: [],
        };
      }

      const payload = (await response.json()) as unknown;

      if (Array.isArray(payload)) {
        return {
          sets: payload.filter(isCatalogHomepageSetCard),
          themes: [],
        };
      }

      if (!payload || typeof payload !== 'object') {
        return {
          sets: [],
          themes: [],
        };
      }

      const candidate = payload as Partial<{
        sets: unknown;
        themes: unknown;
      }>;

      return {
        sets: Array.isArray(candidate.sets)
          ? candidate.sets.filter(isCatalogHomepageSetCard)
          : [],
        themes: Array.isArray(candidate.themes)
          ? candidate.themes.filter(isCatalogThemeDirectoryItem)
          : [],
      };
    })
    .catch(() => ({
      sets: [],
      themes: [],
    }));

  return overlaySearchSuggestionSetCardsRequest;
}

function isCatalogThemeDirectoryItem(
  value: unknown,
): value is CatalogThemeDirectoryItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CatalogThemeDirectoryItem>;
  const themeSnapshot = candidate.themeSnapshot as
    | Partial<CatalogThemeDirectoryItem['themeSnapshot']>
    | undefined;

  return (
    Boolean(themeSnapshot) &&
    typeof themeSnapshot?.name === 'string' &&
    typeof themeSnapshot?.slug === 'string' &&
    typeof themeSnapshot?.setCount === 'number'
  );
}

function listShellWebSearchSuggestions({
  suggestionSetCards,
  query,
}: {
  suggestionSetCards: readonly CatalogHomepageSetCard[];
  query: string;
}): CatalogHomepageSetCard[] {
  const seenSetIds = new Set<string>();

  return listCatalogSetCardSearchMatches({
    limit: 6,
    query,
    setCards: suggestionSetCards,
  })
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.setCard.releaseYear - left.setCard.releaseYear ||
        left.setCard.name.localeCompare(right.setCard.name),
    )
    .flatMap((catalogSearchMatch) => {
      if (seenSetIds.has(catalogSearchMatch.setCard.id)) {
        return [];
      }

      seenSetIds.add(catalogSearchMatch.setCard.id);

      return [catalogSearchMatch.setCard];
    });
}

function normalizeSearchSuggestionText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function normalizeSearchSuggestionToken(value: string): string {
  return normalizeSearchSuggestionText(value).replace(/\s+/gu, '');
}

function getThemeSuggestionScore({
  query,
  theme,
}: {
  query: string;
  theme: CatalogThemeDirectoryItem;
}): number | undefined {
  const normalizedQuery = normalizeSearchSuggestionText(query);
  const normalizedQueryToken = normalizeSearchSuggestionToken(query);
  const normalizedThemeName = normalizeSearchSuggestionText(
    theme.themeSnapshot.name,
  );
  const normalizedThemeSlug = normalizeSearchSuggestionText(
    theme.themeSnapshot.slug.replace(/-/gu, ' '),
  );
  const normalizedThemeToken = normalizeSearchSuggestionToken(
    theme.themeSnapshot.name,
  );

  if (!normalizedQuery || !normalizedQueryToken) {
    return undefined;
  }

  if (
    normalizedThemeName === normalizedQuery ||
    normalizedThemeSlug === normalizedQuery ||
    normalizedThemeToken === normalizedQueryToken
  ) {
    return 0;
  }

  if (
    normalizedThemeName.startsWith(normalizedQuery) ||
    normalizedThemeSlug.startsWith(normalizedQuery) ||
    normalizedThemeToken.startsWith(normalizedQueryToken)
  ) {
    return 1;
  }

  if (
    normalizedThemeName.includes(normalizedQuery) ||
    normalizedThemeSlug.includes(normalizedQuery)
  ) {
    return 2;
  }

  return undefined;
}

function listShellWebThemeSearchSuggestions({
  query,
  themes,
}: {
  query: string;
  themes: readonly CatalogThemeDirectoryItem[];
}): CatalogThemeDirectoryItem[] {
  return themes
    .flatMap((theme) => {
      const score = getThemeSuggestionScore({ query, theme });

      return typeof score === 'number'
        ? [
            {
              score,
              theme,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.theme.themeSnapshot.setCount -
          left.theme.themeSnapshot.setCount ||
        left.theme.themeSnapshot.name.localeCompare(
          right.theme.themeSnapshot.name,
          'nl',
        ),
    )
    .slice(0, 4)
    .map((match) => match.theme);
}

export function ShellWebSearchForm({
  autoFocus = false,
  className,
  closeFallbackHref,
  hideTrigger = false,
  inputId,
  openOnMount = false,
  query,
  restoreFocusTargetId,
  variant = 'inline',
}: {
  autoFocus?: boolean;
  className?: string;
  closeFallbackHref?: string;
  hideTrigger?: boolean;
  inputId: string;
  openOnMount?: boolean;
  query?: string;
  restoreFocusTargetId?: string;
  variant?: 'inline' | 'mobile-overlay';
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<
    ShellWebRecentSearchEntry[]
  >([]);
  const [searchValue, setSearchValue] = useState(query ?? '');
  const [overlaySearchSuggestionSetCards, setOverlaySearchSuggestionSetCards] =
    useState<CatalogHomepageSetCard[]>([]);
  const [overlaySearchSuggestionThemes, setOverlaySearchSuggestionThemes] =
    useState<CatalogThemeDirectoryItem[]>([]);
  const [inlineSearchOverlayRect, setInlineSearchOverlayRect] = useState<{
    left: number;
    top: number;
    width: number;
  }>();
  const searchShellRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const shouldDeferInlineRestoreFocusRef = useRef(false);
  const wasMobileOverlayOpenRef = useRef(false);

  const isMobileOverlay = variant === 'mobile-overlay';

  const focusInlineRestoreTarget = useCallback(() => {
    if (!restoreFocusTargetId || typeof document === 'undefined') {
      return false;
    }

    const focusRestoreTarget = () => {
      const restoreTarget = document.getElementById(restoreFocusTargetId);

      if (restoreTarget instanceof HTMLElement) {
        restoreTarget.focus({ preventScroll: true });
        return true;
      }

      return false;
    };

    requestAnimationFrame(focusRestoreTarget);
    return true;
  }, [restoreFocusTargetId]);

  function listDocumentFocusableElements() {
    if (typeof document === 'undefined') {
      return [];
    }

    return Array.from(
      document.querySelectorAll<HTMLElement>(focusableElementSelector),
    ).filter(
      (focusableElement) =>
        !focusableElement.hasAttribute('disabled') &&
        focusableElement.getAttribute('aria-hidden') !== 'true' &&
        !focusableElement.closest('[data-search-overlay-layer="true"]') &&
        !focusableElement.closest('[data-search-backdrop="true"]'),
    );
  }

  function getPreviousInlineSearchControl() {
    const searchShell = searchShellRef.current;

    if (!searchShell) {
      return undefined;
    }

    return listDocumentFocusableElements()
      .filter(
        (focusableElement) =>
          focusableElement.compareDocumentPosition(searchShell) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      )
      .at(-1);
  }

  function closeInlineSearch(
    reason: InlineSearchCloseReason = 'blur',
    focusTarget?: HTMLElement,
  ) {
    setActiveItemIndex(-1);
    setIsOpen(false);
    searchInputRef.current?.blur();

    shouldDeferInlineRestoreFocusRef.current =
      reason === 'backdrop' || reason === 'escape';

    if (reason === 'tab-forward') {
      focusInlineRestoreTarget();
      return;
    }

    if (reason === 'tab-backward' && focusTarget) {
      requestAnimationFrame(() => {
        focusTarget.focus({ preventScroll: true });
      });
    }
  }

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
    if (!isMobileOverlay || !hideTrigger) {
      return;
    }

    function handleOpenMobileSearchOverlay() {
      flushSync(() => {
        setIsOpen(true);
      });
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
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
  }, [hideTrigger, isMobileOverlay]);

  useLayoutEffect(() => {
    if (isMobileOverlay || !isOpen || typeof window === 'undefined') {
      return;
    }

    document.documentElement.setAttribute('data-shell-search-open', 'true');

    function updateInlineSearchOverlayRect() {
      const searchShellRect = searchShellRef.current?.getBoundingClientRect();

      if (!searchShellRect) {
        return;
      }

      setInlineSearchOverlayRect({
        left: searchShellRect.left,
        top: searchShellRect.top,
        width: searchShellRect.width,
      });
    }

    updateInlineSearchOverlayRect();
    window.addEventListener('resize', updateInlineSearchOverlayRect);

    return () => {
      window.removeEventListener('resize', updateInlineSearchOverlayRect);
      document.documentElement.removeAttribute('data-shell-search-open');
    };
  }, [isMobileOverlay, isOpen]);

  useEffect(() => {
    if (isMobileOverlay || !isOpen || typeof document === 'undefined') {
      return;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const scrollbarWidth = document.documentElement.clientWidth
      ? Math.max(0, window.innerWidth - document.documentElement.clientWidth)
      : 0;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isMobileOverlay, isOpen]);

  useEffect(() => {
    if (isMobileOverlay || typeof document === 'undefined') {
      return undefined;
    }

    function handleDeferredInlineFocus(event: globalThis.KeyboardEvent) {
      if (!shouldDeferInlineRestoreFocusRef.current) {
        return;
      }

      if (event.key !== 'Tab') {
        if (event.key !== 'Shift') {
          shouldDeferInlineRestoreFocusRef.current = false;
        }

        return;
      }

      if (event.shiftKey) {
        shouldDeferInlineRestoreFocusRef.current = false;
        return;
      }

      if (focusInlineRestoreTarget()) {
        event.preventDefault();
      }

      shouldDeferInlineRestoreFocusRef.current = false;
    }

    document.addEventListener('keydown', handleDeferredInlineFocus, true);

    return () => {
      document.removeEventListener('keydown', handleDeferredInlineFocus, true);
    };
  }, [focusInlineRestoreTarget, isMobileOverlay]);

  useEffect(() => {
    if (isMobileOverlay || !isOpen || !inlineSearchOverlayRect) {
      return;
    }

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [inlineSearchOverlayRect, isMobileOverlay, isOpen]);

  useEffect(() => {
    try {
      setRecentSearches(readRecentSearches(window.localStorage));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    void loadOverlaySearchSuggestionSetCards().then((payload) => {
      if (!isCancelled) {
        setOverlaySearchSuggestionSetCards(payload.sets);
        setOverlaySearchSuggestionThemes(payload.themes);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const normalizedSearchValue = normalizeRecentSearchQuery(searchValue);
  const searchSuggestions = normalizedSearchValue
    ? listShellWebSearchSuggestions({
        suggestionSetCards: overlaySearchSuggestionSetCards,
        query: normalizedSearchValue,
      })
    : [];
  const themeSuggestions = normalizedSearchValue
    ? listShellWebThemeSearchSuggestions({
        query: normalizedSearchValue,
        themes: overlaySearchSuggestionThemes,
      })
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
  const themeSuggestionPanelItems = showSuggestionPanel
    ? themeSuggestions.flatMap((themeSuggestion) => {
        const href = buildThemePath(themeSuggestion.themeSnapshot.slug);
        const recentSearchEntry = createRecentSearchQueryEntry(
          themeSuggestion.themeSnapshot.name,
        );

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
    ...themeSuggestionPanelItems,
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
      dispatchMobileSearchOverlayVisibilityEvent(window, true);

      return () => {
        document.body.style.overflow = originalOverflow;
        dispatchMobileSearchOverlayVisibilityEvent(window, false);
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

    if (
      event.relatedTarget instanceof HTMLElement &&
      event.relatedTarget.closest('[data-search-overlay-layer="true"]')
    ) {
      return;
    }

    if (!event.currentTarget.contains(event.relatedTarget)) {
      setActiveItemIndex(-1);
      setIsOpen(false);
      shouldDeferInlineRestoreFocusRef.current = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isMobileOverlay && isOpen && event.key === 'Tab' && event.shiftKey) {
      const previousInlineSearchControl = getPreviousInlineSearchControl();

      if (previousInlineSearchControl) {
        event.preventDefault();
        closeInlineSearch('tab-backward', previousInlineSearchControl);
      }

      return;
    }

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

      if (navigationKey === 'Escape') {
        if (isMobileOverlay) {
          closeMobileOverlay();
        } else {
          closeInlineSearch('escape');
        }

        return;
      }

      setIsOpen(true);
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
      closeMobileOverlay();
    }
  }

  function handleInlineOverlayKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') {
      return;
    }

    const focusableItems = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'input, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (focusableItem) =>
        !focusableItem.hasAttribute('disabled') &&
        focusableItem.getAttribute('aria-hidden') !== 'true',
    );

    if (event.shiftKey) {
      const firstPanelFocusableItem = focusableItems.find(
        (focusableItem) => focusableItem !== searchInputRef.current,
      );

      if (
        firstPanelFocusableItem &&
        document.activeElement === firstPanelFocusableItem
      ) {
        event.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      }

      return;
    }

    const lastFocusableItem = focusableItems.at(-1);

    if (!lastFocusableItem || document.activeElement !== lastFocusableItem) {
      return;
    }

    event.preventDefault();
    closeInlineSearch('tab-forward');
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
    requestAnimationFrame(() => {
      mobileTriggerRef.current?.focus();
    });
  }

  function openMobileOverlay() {
    flushSync(() => {
      setIsOpen(true);
    });
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
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
          <p className={styles.searchPanelHeading}>Passende sets</p>
          {searchSuggestions.length ? (
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
                        panelItemIndex === activeItemIndex ? 'true' : undefined
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
          ) : (
            <p className={styles.searchPanelHint}>
              Nog geen passende sets. Open de volledige resultatenpagina om
              verder te zoeken.
            </p>
          )}
          {themeSuggestions.length ? (
            <>
              <p className={styles.searchPanelHeading}>Thema&apos;s</p>
              <ul className={styles.searchList}>
                {themeSuggestions.map((themeSuggestion, index) => {
                  const panelItemIndex =
                    (showRecentSearches ? recentSearches.length : 0) +
                    searchSuggestionPanelItems.length +
                    index;
                  const themePanelItem = themeSuggestionPanelItems[index];

                  return (
                    <li key={themeSuggestion.themeSnapshot.slug}>
                      <a
                        className={styles.searchThemeLink}
                        data-active={
                          panelItemIndex === activeItemIndex
                            ? 'true'
                            : undefined
                        }
                        href={buildThemePath(
                          themeSuggestion.themeSnapshot.slug,
                        )}
                        onClick={() => {
                          persistRecentSearch(
                            themePanelItem?.recentSearchEntry,
                          );
                          clearOverlayReturnState();
                        }}
                        onMouseEnter={() => setActiveItemIndex(panelItemIndex)}
                      >
                        <span className={styles.searchThemeIcon}>T</span>
                        <span className={styles.searchSuggestionContent}>
                          <span
                            className={`${styles.searchSuggestionName} notranslate`}
                            translate="no"
                          >
                            {themeSuggestion.themeSnapshot.name}
                          </span>
                          <span className={styles.searchSuggestionMeta}>
                            Thema · {themeSuggestion.themeSnapshot.setCount}{' '}
                            sets
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
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
            onClick={openMobileOverlay}
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

  const searchBackdrop =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <button
            aria-label="Zoeken sluiten"
            className={styles.searchBackdrop}
            data-search-backdrop="true"
            onClick={() => closeInlineSearch('backdrop')}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            type="button"
          />,
          document.body,
        )
      : null;
  const shouldPortalInlineSearch =
    isOpen && !isMobileOverlay && Boolean(inlineSearchOverlayRect);
  const inlineSearchOverlay =
    shouldPortalInlineSearch &&
    inlineSearchOverlayRect &&
    typeof document !== 'undefined'
      ? createPortal(
          <div
            className={styles.searchOverlayLayer}
            data-search-overlay-layer="true"
            onKeyDown={handleInlineOverlayKeyDown}
            style={{
              left: inlineSearchOverlayRect.left,
              top: inlineSearchOverlayRect.top,
              width: inlineSearchOverlayRect.width,
            }}
          >
            {searchForm}
            {searchPanel}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={searchShellRef}
      className={[
        styles.searchShell,
        isOpen ? styles.searchShellActive : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onBlur={handleBlur}
      onFocus={() => setIsOpen(true)}
    >
      {searchBackdrop}
      {inlineSearchOverlay}
      {shouldPortalInlineSearch ? (
        <div aria-hidden="true" className={styles.searchPlaceholder} />
      ) : (
        <>
          {searchForm}
          {searchPanel}
        </>
      )}
    </div>
  );
}

export default ShellWebSearchForm;
