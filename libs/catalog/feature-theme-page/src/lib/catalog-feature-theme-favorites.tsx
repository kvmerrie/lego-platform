'use client';

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CatalogSectionShell,
  CatalogThemeHighlight,
} from '@lego-platform/catalog/ui';
import type {
  CatalogUserThemeFavoriteContext,
  CatalogUserThemeFavoriteItem,
} from '@lego-platform/catalog/data-access-web';
import type {
  CatalogThemeDirectoryItem,
  CatalogThemeSnapshot,
  CatalogThemeVisual,
} from '@lego-platform/catalog/util';
import {
  buildThemePath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import {
  Button,
  GatedActionModal,
  SelectableItemDialog,
  type SelectableItemDialogItem,
} from '@lego-platform/shared/ui';
import { Heart, Plus } from 'lucide-react';
import styles from './catalog-feature-theme-page.module.css';

const themeFavoriteModalCopy = {
  body: 'Maak een gratis account aan om je favoriete thema’s, sets en later ook reviews en meldingen te bewaren.',
  primaryLabel: 'Inloggen',
  secondaryLabel: 'Account maken',
  tertiaryLabel: 'Niet nu',
  title: 'Log in om dit te bewaren',
} as const;

interface FavoriteThemeRailCard {
  href: string;
  imageUrl?: string;
  themeId: string;
  themeSnapshot: CatalogThemeSnapshot;
  visual?: CatalogThemeVisual;
}

class FavoriteThemesRailBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn('[favorite-themes-rail] render failed', {
        componentStack: errorInfo.componentStack,
        error,
      });
    }
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function getCurrentReturnUrl(): string {
  if (typeof window === 'undefined') {
    return buildWebPath(webPathnames.home);
  }

  return `${window.location.pathname}${window.location.search}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeFavoriteThemeText(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function normalizeFavoriteThemeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function getThemeDirectoryFavoriteId(
  themeItem: CatalogThemeDirectoryItem,
): string | undefined {
  const themeId = normalizeFavoriteThemeText(themeItem.themeSnapshot.id);
  const slug = normalizeFavoriteThemeText(themeItem.themeSnapshot.slug);

  return themeId ?? (slug ? `theme:${slug}` : undefined);
}

function mapThemeDirectoryItemToRailCard(
  themeItem: CatalogThemeDirectoryItem,
): FavoriteThemeRailCard | undefined {
  const themeId = getThemeDirectoryFavoriteId(themeItem);
  const slug = normalizeFavoriteThemeText(themeItem.themeSnapshot.slug);

  if (!themeId || !slug) {
    return undefined;
  }

  return {
    href: buildThemePath(slug),
    ...(themeItem.imageUrl ? { imageUrl: themeItem.imageUrl } : {}),
    themeId,
    themeSnapshot: {
      id: themeId,
      momentum: themeItem.themeSnapshot.momentum,
      name: themeItem.themeSnapshot.name,
      setCount: themeItem.themeSnapshot.setCount,
      signatureSet: themeItem.themeSnapshot.signatureSet,
      slug,
    },
    ...(themeItem.visual ? { visual: themeItem.visual } : {}),
  };
}

function mapFavoriteThemeToRailCard(
  favoriteTheme: CatalogUserThemeFavoriteItem,
): FavoriteThemeRailCard | undefined {
  const themeSnapshot = favoriteTheme.themeSnapshot;
  const themeId = normalizeFavoriteThemeText(themeSnapshot?.id);
  const slug = normalizeFavoriteThemeText(themeSnapshot?.slug);

  if (!themeId || !slug) {
    return undefined;
  }

  const name =
    normalizeFavoriteThemeText(themeSnapshot.name) ??
    slug
      .split('-')
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  const momentum =
    normalizeFavoriteThemeText(themeSnapshot.momentum) ??
    `Bekijk welke ${name}-sets de moeite waard zijn.`;
  const signatureSet =
    normalizeFavoriteThemeText(themeSnapshot.signatureSet) ?? name;
  const setCount = normalizeFavoriteThemeCount(themeSnapshot.setCount);
  const imageUrl =
    normalizeFavoriteThemeText(favoriteTheme.visual?.tileImageUrl) ??
    normalizeFavoriteThemeText(favoriteTheme.imageUrl) ??
    normalizeFavoriteThemeText(favoriteTheme.visual?.imageUrl);
  const backgroundColor = normalizeFavoriteThemeText(
    favoriteTheme.visual?.backgroundColor,
  );
  const textColor = normalizeFavoriteThemeText(favoriteTheme.visual?.textColor);
  const visual =
    backgroundColor || textColor || imageUrl
      ? {
          ...(backgroundColor ? { backgroundColor } : {}),
          ...(imageUrl ? { imageUrl, tileImageUrl: imageUrl } : {}),
          ...(textColor ? { textColor } : {}),
        }
      : undefined;

  return {
    href: buildThemePath(slug),
    ...(imageUrl ? { imageUrl } : {}),
    themeId,
    themeSnapshot: {
      id: themeId,
      momentum,
      name,
      setCount,
      signatureSet,
      slug,
    },
    ...(visual ? { visual } : {}),
  };
}

export function CatalogFeatureThemeFavoriteToggle({
  buttonSurface = 'light',
  className,
  themeId,
  themeName,
}: {
  buttonSurface?: 'dark' | 'light';
  className?: string;
  themeId: string;
  themeName: string;
}) {
  const [favoriteContext, setFavoriteContext] =
    useState<CatalogUserThemeFavoriteContext>({
      isAuthenticated: false,
      isFavorited: false,
      themeId,
    });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    async function loadFavoriteContext() {
      if (!themeId) {
        return;
      }

      try {
        const { getUserThemeFavoriteContextForBrowser } = await import(
          '@lego-platform/catalog/data-access-web'
        );
        const nextFavoriteContext = await getUserThemeFavoriteContextForBrowser(
          {
            signal: abortController.signal,
            themeId,
          },
        );

        if (isActive && !abortController.signal.aborted) {
          setFavoriteContext(nextFavoriteContext);
        }
      } catch {
        if (isActive && !abortController.signal.aborted) {
          setFavoriteContext({
            isAuthenticated: false,
            isFavorited: false,
            themeId,
          });
        }
      }
    }

    loadFavoriteContext();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [themeId]);

  useEffect(() => {
    if (!isModalOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsModalOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen) {
      triggerButtonRef.current?.focus();
    }
  }, [isModalOpen]);

  const handleToggle = useCallback(async () => {
    if (!themeId || isPending) {
      return;
    }

    if (!favoriteContext.isAuthenticated) {
      setIsModalOpen(true);
      return;
    }

    const previousContext = favoriteContext;
    const nextIsFavorited = !favoriteContext.isFavorited;

    setIsPending(true);
    setFavoriteContext({
      ...favoriteContext,
      isFavorited: nextIsFavorited,
    });

    try {
      const {
        addUserThemeFavoriteForBrowser,
        removeUserThemeFavoriteForBrowser,
      } = await import('@lego-platform/catalog/data-access-web');

      const nextFavoriteState = nextIsFavorited
        ? await addUserThemeFavoriteForBrowser({ themeId })
        : await removeUserThemeFavoriteForBrowser({ themeId });

      setFavoriteContext({
        isAuthenticated: true,
        isFavorited: nextFavoriteState.isFavorited,
        themeId: nextFavoriteState.themeId,
      });
    } catch {
      setFavoriteContext(previousContext);
    } finally {
      setIsPending(false);
    }
  }, [favoriteContext, isPending, themeId]);

  return (
    <>
      <Button
        aria-label={
          favoriteContext.isFavorited ? 'Thema opgeslagen' : 'Thema bewaren'
        }
        aria-pressed={favoriteContext.isFavorited}
        className={[styles.introFavoriteAction, className]
          .filter(Boolean)
          .join(' ')}
        disabled={!themeId}
        isLoading={isPending}
        ref={triggerButtonRef}
        surface={buttonSurface}
        title={
          favoriteContext.isFavorited
            ? `${themeName} opgeslagen`
            : `${themeName} bewaren`
        }
        tone="secondary"
        onClick={handleToggle}
      >
        <Heart
          aria-hidden="true"
          className={styles.introFavoriteIcon}
          fill={favoriteContext.isFavorited ? 'currentColor' : 'none'}
        />
        <span className={styles.introFavoriteLabel}>
          {favoriteContext.isFavorited ? 'Volgt' : 'Volg thema'}
        </span>
      </Button>
      {isModalOpen ? (
        <GatedActionModal
          action="theme_favorite"
          body={themeFavoriteModalCopy.body}
          primaryHref={buildWebPath(webPathnames.account)}
          primaryLabel={themeFavoriteModalCopy.primaryLabel}
          reason="theme_favorite"
          returnUrl={getCurrentReturnUrl()}
          secondaryHref={`${buildWebPath(webPathnames.account)}?auth=sign-up`}
          secondaryLabel={themeFavoriteModalCopy.secondaryLabel}
          tertiaryLabel={themeFavoriteModalCopy.tertiaryLabel}
          title={themeFavoriteModalCopy.title}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function CatalogFeatureFavoriteThemesRailContent({
  availableThemes = [],
  showAddTileForAnonymous = false,
  title = 'Jouw favoriete thema’s',
}: {
  availableThemes?: readonly CatalogThemeDirectoryItem[];
  showAddTileForAnonymous?: boolean;
  title?: string;
}) {
  const [favoriteThemes, setFavoriteThemes] = useState<FavoriteThemeRailCard[]>(
    [],
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingThemeIds, setPendingThemeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pickerError, setPickerError] = useState<string | undefined>();
  const favoriteThemeIdSet = useMemo(
    () => new Set(favoriteThemes.map((favoriteTheme) => favoriteTheme.themeId)),
    [favoriteThemes],
  );
  const themePickerItems = useMemo<SelectableItemDialogItem[]>(
    () =>
      availableThemes.flatMap((themeItem) => {
        const themeId = getThemeDirectoryFavoriteId(themeItem);
        const railCard = mapThemeDirectoryItemToRailCard(themeItem);

        if (!themeId || !railCard) {
          return [];
        }

        return [
          {
            description: themeItem.themeSnapshot.signatureSet,
            id: themeId,
            imageAlt: `${themeItem.themeSnapshot.signatureSet} LEGO-set`,
            imageUrl: themeItem.visual?.tileImageUrl ?? themeItem.imageUrl,
            isLoading: pendingThemeIds.has(themeId),
            isSelected: favoriteThemeIdSet.has(themeId),
            label: themeItem.themeSnapshot.name,
            meta: `${themeItem.themeSnapshot.setCount} sets`,
            searchText: [
              themeItem.themeSnapshot.name,
              themeItem.themeSnapshot.signatureSet,
              themeItem.themeSnapshot.slug,
            ].join(' '),
            swatchColor:
              themeItem.visual?.backgroundColor ?? themeItem.visual?.textColor,
          },
        ];
      }),
    [availableThemes, favoriteThemeIdSet, pendingThemeIds],
  );

  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    async function loadFavoriteThemes() {
      try {
        const { listUserThemeFavoritesForBrowser } = await import(
          '@lego-platform/catalog/data-access-web'
        );
        const nextFavoriteThemes = await listUserThemeFavoritesForBrowser({
          signal: abortController.signal,
        });

        if (isActive && !abortController.signal.aborted) {
          const nextRailCards = nextFavoriteThemes.themes.flatMap(
            (favoriteTheme) => {
              const railCard = mapFavoriteThemeToRailCard(favoriteTheme);

              return railCard ? [railCard] : [];
            },
          );

          if (
            process.env['NODE_ENV'] !== 'production' &&
            nextFavoriteThemes.themes.length !== nextRailCards.length
          ) {
            console.warn('[favorite-themes-rail] skipped malformed items', {
              received: nextFavoriteThemes.themes.length,
              rendered: nextRailCards.length,
            });
          }

          setIsAuthenticated(nextFavoriteThemes.isAuthenticated);
          setFavoriteThemes(nextRailCards);
        }
      } catch {
        if (isActive && !abortController.signal.aborted) {
          setIsAuthenticated(false);
          setFavoriteThemes([]);
        }
      }
    }

    loadFavoriteThemes();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, []);

  const handleAddTileClick = useCallback(() => {
    if (!isAuthenticated) {
      setIsModalOpen(true);
      return;
    }

    setPickerError(undefined);
    setIsPickerOpen(true);
  }, [isAuthenticated]);

  const handleTogglePickerItem = useCallback(
    async (item: SelectableItemDialogItem) => {
      const themeId = item.id;
      const themeItem = availableThemes.find(
        (availableTheme) =>
          getThemeDirectoryFavoriteId(availableTheme) === themeId,
      );
      const railCard = themeItem
        ? mapThemeDirectoryItemToRailCard(themeItem)
        : undefined;

      if (!railCard || pendingThemeIds.has(themeId)) {
        return;
      }

      const wasSelected = favoriteThemeIdSet.has(themeId);
      const previousFavoriteThemes = favoriteThemes;

      setPickerError(undefined);
      setPendingThemeIds((current) => new Set(current).add(themeId));
      setFavoriteThemes((current) =>
        wasSelected
          ? current.filter((favoriteTheme) => favoriteTheme.themeId !== themeId)
          : [railCard, ...current],
      );

      try {
        const {
          addUserThemeFavoriteForBrowser,
          removeUserThemeFavoriteForBrowser,
        } = await import('@lego-platform/catalog/data-access-web');

        if (wasSelected) {
          await removeUserThemeFavoriteForBrowser({ themeId });
        } else {
          await addUserThemeFavoriteForBrowser({ themeId });
        }
      } catch {
        setFavoriteThemes(previousFavoriteThemes);
        setPickerError(
          wasSelected
            ? 'Dit thema kon niet worden verwijderd.'
            : 'Dit thema kon niet worden toegevoegd.',
        );
      } finally {
        setPendingThemeIds((current) => {
          const next = new Set(current);

          next.delete(themeId);

          return next;
        });
      }
    },
    [availableThemes, favoriteThemeIdSet, favoriteThemes, pendingThemeIds],
  );

  if (!isAuthenticated && !showAddTileForAnonymous) {
    return null;
  }

  return (
    <>
      <CatalogSectionShell
        as="section"
        bodyClassName={styles.favoriteThemesBody}
        bodySpacing="compact"
        className={styles.favoriteThemesSection}
        headingClassName={styles.favoriteThemesHeader}
        padding="default"
        spacing="default"
        title={title}
        titleAs="h2"
        tone="inverse"
      >
        <div className={styles.favoriteThemesRailViewport}>
          <div className={styles.favoriteThemesRailTrack}>
            {favoriteThemes.map((favoriteTheme, index) => (
              <CatalogThemeHighlight
                href={favoriteTheme.href}
                imageUrl={favoriteTheme.imageUrl}
                key={favoriteTheme.themeId}
                themeSnapshot={favoriteTheme.themeSnapshot}
                trackingEvent={{
                  event: 'theme_tile_click',
                  properties: {
                    pageSurface: 'theme_index',
                    rankPosition: index + 1,
                    sectionId: 'favorite-themes',
                    tileType: 'favorite_theme',
                    theme: favoriteTheme.themeSnapshot.name,
                  },
                }}
                variant="portrait"
                visual={favoriteTheme.visual}
              />
            ))}
            <div className={styles.favoriteThemesAddTile}>
              <button
                className={styles.favoriteThemesAddButton}
                type="button"
                onClick={handleAddTileClick}
              >
                <div
                  className={styles.favoriteThemesAddVisual}
                  aria-hidden="true"
                >
                  <Plus
                    className={styles.favoriteThemesAddIcon}
                    size={76}
                    strokeWidth={1.8}
                  />
                </div>
                <div className={styles.favoriteThemesAddBody}>
                  <h3 className={styles.favoriteThemesAddTitle}>
                    Thema’s toevoegen
                  </h3>
                  <p className={styles.favoriteThemesAddMeta}>
                    Kies je favorieten
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </CatalogSectionShell>
      <SelectableItemDialog
        description="Voeg thema’s toe of haal ze weg. De lijst blijft open zodat je meerdere keuzes achter elkaar kunt maken."
        emptyLabel="Geen thema’s gevonden."
        isOpen={isPickerOpen}
        items={themePickerItems}
        searchLabel="Thema zoeken"
        searchPlaceholder="Zoek thema"
        title="Thema’s toevoegen"
        onClose={() => setIsPickerOpen(false)}
        onToggle={handleTogglePickerItem}
      />
      {pickerError ? (
        <p className={styles.favoriteThemesPickerError} role="status">
          {pickerError}
        </p>
      ) : null}
      {isModalOpen ? (
        <GatedActionModal
          action="theme_favorite"
          body={themeFavoriteModalCopy.body}
          primaryHref={buildWebPath(webPathnames.account)}
          primaryLabel={themeFavoriteModalCopy.primaryLabel}
          reason="theme_favorite"
          returnUrl={getCurrentReturnUrl()}
          secondaryHref={`${buildWebPath(webPathnames.account)}?auth=sign-up`}
          secondaryLabel={themeFavoriteModalCopy.secondaryLabel}
          tertiaryLabel={themeFavoriteModalCopy.tertiaryLabel}
          title={themeFavoriteModalCopy.title}
          onClose={() => setIsModalOpen(false)}
        />
      ) : null}
    </>
  );
}

export function CatalogFeatureFavoriteThemesRail({
  availableThemes,
  showAddTileForAnonymous,
  title = 'Jouw favoriete thema’s',
}: {
  availableThemes?: readonly CatalogThemeDirectoryItem[];
  showAddTileForAnonymous?: boolean;
  title?: string;
}) {
  return (
    <FavoriteThemesRailBoundary>
      <CatalogFeatureFavoriteThemesRailContent
        availableThemes={availableThemes}
        showAddTileForAnonymous={showAddTileForAnonymous}
        title={title}
      />
    </FavoriteThemesRailBoundary>
  );
}
