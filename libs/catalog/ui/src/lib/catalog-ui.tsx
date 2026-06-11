import {
  forwardRef,
  type CSSProperties,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import type {
  CatalogHomepageSetCard,
  CatalogProductFeature,
  CatalogPublicThemeReference,
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import {
  buildCatalogReleaseLabel,
  buildCatalogThemeSlug,
  type CatalogSetImage,
  normalizeCatalogSetImages,
} from '@lego-platform/catalog/util';
import { PRODUCT_REVIEWS_SECTION_ID } from '@lego-platform/shared/config';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  Star,
  ToyBrick,
} from 'lucide-react';
import {
  CatalogKeyFacts,
  CatalogOfferComparison,
  CatalogPriceDecisionPrimary,
  CatalogPriceDecisionSecondary,
  CatalogTrustPanel,
  getCatalogDecisionSupportTitle,
  type CatalogKeyFact,
  type CatalogSetDetailBestDeal,
  type CatalogSetDetailOfferItem,
  type CatalogSetDetailSupportItem,
  type CatalogSetDetailTrustSignal,
  type CatalogSetDetailVerdict,
} from './catalog-commerce-ui';
import { CatalogPageIntro, CatalogSetDetailHero } from './catalog-composite-ui';
import {
  ActionLink,
  Badge,
  DetailAccordionSection,
  ImageGallery,
  LabelValue,
  LabelValueList,
  MarkerList,
  Panel,
  SectionHeading,
  Surface,
  VisuallyHidden,
  type CarouselImage,
} from '@lego-platform/shared/ui';
import {
  buildBrickhuntAnalyticsAttributes,
  type BrickhuntAnalyticsEventDescriptor,
} from '@lego-platform/shared/util';
import { CatalogSetCardCollectionBrowseMobileLayout } from './catalog-set-card-mobile-layout';
import { CatalogSetDetailReviewLink } from './catalog-set-detail-review-link';
import styles from './catalog-ui.module.css';

function joinClassNames(
  ...classNames: Array<string | false | null | undefined>
): string | undefined {
  const className = classNames.filter(Boolean).join(' ');

  return className || undefined;
}

export {
  CatalogPageIntro,
  CatalogQuickFilterBar,
  CatalogHeroMedia,
  CatalogSectionHeader,
  CatalogSectionShell,
  CatalogSetDetailHero,
  CatalogSplitIntroPanel,
  getHeroButtonSurface,
  getHeroButtonTone,
  type CatalogIntroPanelSection,
  type HeroActionVariant,
  type HeroButtonSurface,
  type HeroButtonToneInput,
} from './catalog-composite-ui';

export interface CatalogSetDetailReviewSummary {
  averageRating?: number;
  reviewCount: number;
}

type CatalogSetCardSummary = CatalogSetSummary &
  Partial<Pick<CatalogHomepageSetCard, 'availability' | 'tagline'>> & {
    cardImageUrl?: string;
  };

type CatalogSetCardPriceContextTone =
  | 'accent'
  | 'info'
  | 'neutral'
  | 'positive'
  | 'warning';

type CatalogSetCardBadgeTone = ComponentProps<typeof Badge>['tone'];

export interface CatalogThemeVisual {
  backgroundColor?: string;
  imageUrl?: string;
  textColor?: string;
}

export interface CatalogSetCardPriceContext {
  coverageLabel: string;
  currentPrice: string;
  dealReason?: string;
  discountMetric?: string;
  decisionLabel?: string;
  decisionNote?: string;
  merchantLabel: string;
  primaryActionHref?: string;
  primaryActionTrackingEvent?: BrickhuntAnalyticsEventDescriptor;
  pricePositionLabel?: string;
  pricePositionTone?: CatalogSetCardPriceContextTone;
  reviewedLabel: string;
}

export interface CatalogSetCardContextBadge {
  label: string;
  tone?: CatalogSetCardBadgeTone;
}

type CatalogSetCardVariant = 'compact' | 'default' | 'featured';
type CatalogSetSavedState = 'owned' | 'wishlist';
type CatalogSetCardPriceDisplay = 'default' | 'subtle';
type CatalogSetCardCollectionLayout = 'grid' | 'rail';
type CatalogSetCardCollectionGridMode = 'browse' | 'tiles';
export type CatalogSetCardCtaMode = 'default' | 'commerce';

const CATALOG_A11Y_TEXT_DARK = '#05070d';
const CATALOG_A11Y_TEXT_LIGHT = '#ffffff';
const CATALOG_A11Y_CONTRAST_AA = 4.5;

export interface CatalogBrowsePaginationProps {
  ariaLabel: string;
  basePath: string;
  className?: string;
  currentPage?: number;
  pageCount: number;
  queryParams?: Readonly<Record<string, string | undefined>>;
  topHref?: string;
}

type CatalogBrowsePaginationItem =
  | {
      page: number;
      type: 'page';
    }
  | {
      id: string;
      type: 'ellipsis';
    };

function buildCatalogBrowsePageHref({
  basePath,
  page,
  queryParams,
}: {
  basePath: string;
  page: number;
  queryParams?: Readonly<Record<string, string | undefined>>;
}): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(queryParams ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  if (page > 1) {
    searchParams.set('page', String(page));
  } else {
    searchParams.delete('page');
  }

  const queryString = searchParams.toString();

  return queryString ? `${basePath}?${queryString}` : basePath;
}

function buildCatalogBrowsePaginationItems({
  currentPage,
  maxNumericItems,
  pageCount,
  siblingCount,
}: {
  currentPage: number;
  maxNumericItems: number;
  pageCount: number;
  siblingCount: number;
}): CatalogBrowsePaginationItem[] {
  if (pageCount <= maxNumericItems) {
    return Array.from({ length: pageCount }, (_, index) => ({
      page: index + 1,
      type: 'page' as const,
    }));
  }

  const innerNumericCount = Math.max(1, maxNumericItems - 2);
  const desiredStart = currentPage - siblingCount;
  const desiredEnd = currentPage + siblingCount;
  const startPage = Math.max(
    2,
    Math.min(desiredStart, pageCount - innerNumericCount),
  );
  const endPage = Math.min(
    pageCount - 1,
    Math.max(desiredEnd, startPage + innerNumericCount - 1),
  );
  const items: CatalogBrowsePaginationItem[] = [{ page: 1, type: 'page' }];

  if (startPage > 2) {
    items.push({ id: 'start-ellipsis', type: 'ellipsis' });
  }

  for (let page = startPage; page <= endPage; page += 1) {
    items.push({ page, type: 'page' });
  }

  if (endPage < pageCount - 1) {
    items.push({ id: 'end-ellipsis', type: 'ellipsis' });
  }

  items.push({ page: pageCount, type: 'page' });

  return items;
}

export function CatalogBrowsePagination({
  ariaLabel,
  basePath,
  className,
  currentPage = 1,
  pageCount,
  queryParams,
  topHref = '#top',
}: CatalogBrowsePaginationProps) {
  const normalizedPageCount = Math.max(1, Math.floor(pageCount));
  const normalizedCurrentPage = Math.min(
    normalizedPageCount,
    Math.max(1, Math.floor(currentPage)),
  );

  if (normalizedPageCount <= 1) {
    return (
      <div
        className={[styles.browsePagination, className]
          .filter(Boolean)
          .join(' ')}
      >
        <a className={styles.browsePaginationSecondaryLink} href={topHref}>
          Terug naar boven
        </a>
      </div>
    );
  }

  const previousPage = Math.max(1, normalizedCurrentPage - 1);
  const nextPage = Math.min(normalizedPageCount, normalizedCurrentPage + 1);
  const tabletItems = buildCatalogBrowsePaginationItems({
    currentPage: normalizedCurrentPage,
    maxNumericItems: 5,
    pageCount: normalizedPageCount,
    siblingCount: 1,
  });
  const desktopItems = buildCatalogBrowsePaginationItems({
    currentPage: normalizedCurrentPage,
    maxNumericItems: 7,
    pageCount: normalizedPageCount,
    siblingCount: 2,
  });
  const renderPageItems = (
    items: readonly CatalogBrowsePaginationItem[],
    breakpoint: 'desktop' | 'tablet',
  ) => (
    <ol
      className={[
        styles.browsePaginationList,
        breakpoint === 'tablet'
          ? styles.browsePaginationTabletList
          : styles.browsePaginationDesktopList,
      ]
        .filter(Boolean)
        .join(' ')}
      data-pagination-breakpoint={breakpoint}
    >
      {items.map((item) =>
        item.type === 'ellipsis' ? (
          <li className={styles.browsePaginationItem} key={item.id}>
            <span
              aria-hidden="true"
              className={styles.browsePaginationEllipsis}
            >
              ...
            </span>
          </li>
        ) : (
          <li className={styles.browsePaginationItem} key={item.page}>
            <a
              aria-current={
                item.page === normalizedCurrentPage ? 'page' : undefined
              }
              aria-label={
                item.page === normalizedCurrentPage
                  ? `Pagina ${item.page}, huidige pagina`
                  : `Ga naar pagina ${item.page}`
              }
              className={styles.browsePaginationPageLink}
              href={buildCatalogBrowsePageHref({
                basePath,
                page: item.page,
                queryParams,
              })}
            >
              {item.page}
            </a>
          </li>
        ),
      )}
    </ol>
  );

  return (
    <nav
      aria-label={ariaLabel}
      className={[styles.browsePagination, className].filter(Boolean).join(' ')}
    >
      <a
        aria-disabled={normalizedCurrentPage === 1 ? 'true' : undefined}
        className={styles.browsePaginationStepLink}
        href={buildCatalogBrowsePageHref({
          basePath,
          page: previousPage,
          queryParams,
        })}
      >
        Vorige
      </a>
      <span
        aria-current="page"
        aria-label={`Pagina ${normalizedCurrentPage} van ${normalizedPageCount}`}
        className={styles.browsePaginationMobileIndicator}
        data-pagination-breakpoint="mobile"
      >
        {normalizedCurrentPage} van {normalizedPageCount}
      </span>
      {renderPageItems(tabletItems, 'tablet')}
      {renderPageItems(desktopItems, 'desktop')}
      <a
        aria-disabled={
          normalizedCurrentPage === normalizedPageCount ? 'true' : undefined
        }
        className={styles.browsePaginationStepLink}
        href={buildCatalogBrowsePageHref({
          basePath,
          page: nextPage,
          queryParams,
        })}
      >
        Volgende
      </a>
    </nav>
  );
}

export function CatalogRailTertiaryAction({
  children,
  className,
  ...props
}: ComponentProps<typeof ActionLink>) {
  return (
    <ActionLink
      className={[styles.railActionLink, className].filter(Boolean).join(' ')}
      tone="inline"
      {...props}
    >
      <span>{children}</span>
      <ChevronRight aria-hidden="true" size={16} strokeWidth={2.2} />
    </ActionLink>
  );
}

export const CatalogRailActionLink = CatalogRailTertiaryAction;

export const CatalogSetCardCollection = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    gridMode?: CatalogSetCardCollectionGridMode;
    layout?: CatalogSetCardCollectionLayout;
    variant?: Extract<CatalogSetCardVariant, 'compact' | 'featured'>;
  }
>(function CatalogSetCardCollection(
  {
    children,
    className,
    gridMode = 'tiles',
    layout = 'grid',
    variant = 'featured',
    ...rest
  },
  ref,
) {
  const isBrowseGrid = layout === 'grid' && gridMode === 'browse';
  const collectionClassName = [
    styles.setCardCollection,
    isBrowseGrid ? styles.setCardCollectionBrowse : null,
    layout === 'rail' ? styles.setCardCollectionRail : null,
    variant === 'compact'
      ? styles.setCardCollectionCompact
      : styles.setCardCollectionFeatured,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const collectionProps = {
    'data-catalog-set-card-collection': 'true',
    'data-catalog-set-card-collection-grid-mode': gridMode,
    'data-catalog-set-card-collection-layout': layout,
    'data-catalog-set-card-collection-variant': variant,
    ...rest,
  };

  if (isBrowseGrid) {
    return (
      <CatalogSetCardCollectionBrowseMobileLayout
        className={collectionClassName}
        ref={ref}
        {...collectionProps}
      >
        {children}
      </CatalogSetCardCollectionBrowseMobileLayout>
    );
  }

  return (
    <div className={collectionClassName} ref={ref} {...collectionProps}>
      {children}
    </div>
  );
});

function getSavedStateBadgeTone(
  savedState: CatalogSetSavedState,
): ComponentProps<typeof Badge>['tone'] {
  return savedState === 'owned' ? 'positive' : 'neutral';
}

function getSavedStateLabel(savedState: CatalogSetSavedState): string {
  return savedState === 'owned' ? 'In collectie' : 'Op verlanglijst';
}

function CatalogCanonicalText({ children }: { children: ReactNode }) {
  return (
    <span className="notranslate" translate="no">
      {children}
    </span>
  );
}

function getCatalogSetVisibleTitle(
  catalogSetDetail: Pick<CatalogSetDetail, 'displayTitle' | 'name'>,
): string {
  return catalogSetDetail.displayTitle?.trim() || catalogSetDetail.name;
}

function getCatalogSetVisualImageSizes(variant: 'card' | 'hero'): string {
  return variant === 'hero'
    ? '(min-width: 64rem) 48rem, 100vw'
    : '(min-width: 64rem) 280px, (min-width: 48rem) 33vw, 100vw';
}

function shouldOptimizeCatalogSetVisualImage(imageUrl: string): boolean {
  try {
    const parsedImageUrl = new URL(imageUrl);

    return (
      parsedImageUrl.protocol === 'https:' &&
      parsedImageUrl.hostname === 'cdn.rebrickable.com' &&
      parsedImageUrl.pathname.startsWith('/media/sets/')
    );
  } catch {
    return false;
  }
}

function getCatalogSetCardImageUrl(
  setSummary: CatalogSetCardSummary,
): string | undefined {
  return (
    setSummary.cardImageUrl ?? setSummary.imageUrl ?? setSummary.primaryImage
  );
}

function CatalogSetVisual({
  altLabel,
  imageFetchPriority,
  imageUrl,
  imageLoading,
  name,
  overlayBadges,
  overlayControls,
  setId,
  theme,
  variant,
}: {
  altLabel?: string;
  imageFetchPriority?: 'auto' | 'high' | 'low';
  imageUrl?: string;
  imageLoading?: 'eager' | 'lazy';
  name: string;
  overlayBadges?: ReactNode;
  overlayControls?: ReactNode;
  setId: string;
  theme: string;
  variant: 'card' | 'hero';
}) {
  const visualClassName =
    variant === 'hero'
      ? `${styles.setVisual} ${styles.heroVisual}`
      : `${styles.setVisual} ${styles.cardVisual}`;

  if (imageUrl) {
    return (
      <div
        className={visualClassName}
        data-catalog-set-card-visual="true"
        data-catalog-set-card-visual-variant={variant}
      >
        {overlayBadges ? (
          <div className={styles.visualOverlay}>{overlayBadges}</div>
        ) : null}
        {overlayControls ? (
          <div
            className={styles.visualActionSlot}
            data-catalog-set-card-visual-actions="true"
          >
            {overlayControls}
          </div>
        ) : null}
        <div className={styles.visualMedia}>
          {shouldOptimizeCatalogSetVisualImage(imageUrl) ? (
            <Image
              alt={altLabel ?? `${name} LEGO-set`}
              className={styles.setImage}
              decoding="async"
              fetchPriority={
                imageFetchPriority ?? (variant === 'hero' ? 'high' : 'auto')
              }
              height={variant === 'hero' ? 900 : 420}
              loading={imageLoading ?? (variant === 'hero' ? 'eager' : 'lazy')}
              preload={imageFetchPriority === 'high' || variant === 'hero'}
              sizes={getCatalogSetVisualImageSizes(variant)}
              src={imageUrl}
              width={variant === 'hero' ? 1200 : 420}
            />
          ) : (
            <img
              alt={altLabel ?? `${name} LEGO-set`}
              className={styles.setImage}
              decoding="async"
              fetchPriority={
                imageFetchPriority ?? (variant === 'hero' ? 'high' : 'auto')
              }
              height={variant === 'hero' ? 900 : 420}
              loading={imageLoading ?? (variant === 'hero' ? 'eager' : 'lazy')}
              src={imageUrl}
              width={variant === 'hero' ? 1200 : 420}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${visualClassName} ${styles.visualFallback}`}
      data-catalog-set-card-visual="true"
      data-catalog-set-card-visual-variant={variant}
    >
      {overlayBadges ? (
        <div className={styles.visualOverlay}>{overlayBadges}</div>
      ) : null}
      {overlayControls ? (
        <div
          className={styles.visualActionSlot}
          data-catalog-set-card-visual-actions="true"
        >
          {overlayControls}
        </div>
      ) : null}
      {!overlayBadges ? (
        <Badge tone="accent">
          <CatalogCanonicalText>{theme}</CatalogCanonicalText>
        </Badge>
      ) : null}
      <p className={styles.visualFallbackTitle}>
        Officiele afbeelding nog niet gepubliceerd
      </p>
      <p className={styles.visualFallbackMeta}>Set {setId}</p>
    </div>
  );
}

function CatalogSupportingDetail({
  emphasis = 'regular',
  label,
  tone = 'default',
  value,
}: {
  emphasis?: 'regular' | 'strong';
  label: string;
  tone?: 'default' | 'muted';
  value: ReactNode;
}) {
  return (
    <LabelValue
      className={styles.supportingDetail}
      emphasis={emphasis}
      label={label}
      tone={tone}
      value={value}
    />
  );
}

function CatalogSetMetadata({
  className,
  items,
}: {
  className?: string;
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <LabelValueList
      className={
        className ? `${styles.metaGrid} ${className}` : styles.metaGrid
      }
      items={items.map((item) => ({
        emphasis: 'regular' as const,
        id: item.label,
        label: item.label,
        value: item.value,
      }))}
      spacing="compact"
    />
  );
}

function getCardMerchantLabel(merchantLabel: string): string {
  const trimmedMerchantLabel = merchantLabel.trim();
  const dutchPrefix = 'Nu het laagst bij ';
  const englishPrefix = 'Lowest reviewed price at ';

  if (trimmedMerchantLabel.startsWith(dutchPrefix)) {
    return `Laagst bij ${trimmedMerchantLabel.slice(dutchPrefix.length)}`;
  }

  if (trimmedMerchantLabel.startsWith(englishPrefix)) {
    return `Laagst bij ${trimmedMerchantLabel.slice(englishPrefix.length)}`;
  }

  if (trimmedMerchantLabel.includes(' bij ')) {
    return trimmedMerchantLabel;
  }

  return `Laagst bij ${trimmedMerchantLabel}`;
}

function isDuplicatePriceContextLine(left?: string, right?: string): boolean {
  return Boolean(left && right && left.trim() === right.trim());
}

function buildCompactDealValueLine(
  priceContext: CatalogSetCardPriceContext,
): string | undefined {
  const isPricePerBrickCopy = (value: string): boolean =>
    /\b(?:ct|cent)\s*(?:\/|per)\s*steen\b/iu.test(value);
  const valueParts = [
    priceContext.discountMetric,
    isDuplicatePriceContextLine(
      priceContext.dealReason,
      priceContext.discountMetric,
    )
      ? undefined
      : priceContext.dealReason,
  ]
    .map((value) => value?.trim())
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        value.length > 0 &&
        !isPricePerBrickCopy(value),
    );

  return valueParts.length ? valueParts.join(' · ') : undefined;
}

function getCardPrimaryActionConfig({
  href,
  priceContext,
  trackingEvent,
}: {
  ctaMode: CatalogSetCardCtaMode;
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  variant: CatalogSetCardVariant;
}): {
  ariaLabel: string;
  className: string;
  href?: string;
  icon: typeof Eye;
  label: string;
  rel?: string;
  target?: '_blank';
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
} {
  const hasKnownPrice =
    priceContext && !/^prijs volgt$/iu.test(priceContext.currentPrice.trim());

  if (!hasKnownPrice) {
    return {
      ariaLabel: 'Bekijk set, prijs volgt',
      className: styles.cardCompactActionPending,
      href,
      icon: Clock3,
      label: 'Prijs volgt',
      trackingEvent,
    };
  }

  return {
    ariaLabel: 'Bekijk set',
    className: styles.cardCompactActionBrowse,
    href,
    icon: Eye,
    label: 'Bekijk set',
    trackingEvent,
  };
}

function formatCardSetFacts(setSummary: CatalogSetCardSummary): Array<{
  accessibleLabel: string;
  icon: typeof CalendarDays;
  id: string;
  value: string;
}> {
  const releaseYearLabel = setSummary.releaseYear.toString();
  const piecesLabel = setSummary.pieces.toLocaleString('nl-NL');

  return [
    {
      accessibleLabel: `Uitgekomen in ${releaseYearLabel}`,
      icon: CalendarDays,
      id: 'release',
      value: releaseYearLabel,
    },
    {
      accessibleLabel: `${piecesLabel} stenen`,
      icon: ToyBrick,
      id: 'piece-count',
      value: piecesLabel,
    },
  ];
}

function CatalogSetFactRow({
  className,
  setSummary,
}: {
  className?: string;
  setSummary: CatalogSetCardSummary;
}) {
  const factItems = formatCardSetFacts(setSummary);

  return (
    <div
      className={
        className ? `${styles.cardFactRow} ${className}` : styles.cardFactRow
      }
    >
      {factItems.map((factItem) => {
        const FactIcon = factItem.icon;

        return (
          <span className={styles.cardFactItem} key={factItem.id}>
            <VisuallyHidden>{factItem.accessibleLabel}</VisuallyHidden>
            <FactIcon
              aria-hidden="true"
              className={styles.cardFactIcon}
              strokeWidth={2.2}
            />
            <span aria-hidden="true">{factItem.value}</span>
          </span>
        );
      })}
    </div>
  );
}

function getCatalogSetCardReleaseMetaValue(
  setSummary: CatalogSetCardSummary,
): string {
  return (
    buildCatalogReleaseLabel({
      releaseDate: setSummary.releaseDate,
      releaseDatePrecision: setSummary.releaseDatePrecision,
      releaseYear: setSummary.releaseYear,
      variant: 'compact',
    })?.value ?? setSummary.releaseYear.toString()
  );
}

function getCatalogSetMetadataReleaseItem(setSummary: CatalogSetCardSummary): {
  label: string;
  value: string | number;
} {
  const detailedReleaseLabel = buildCatalogReleaseLabel({
    releaseDate: setSummary.releaseDate,
    releaseDatePrecision: setSummary.releaseDatePrecision,
    releaseYear: setSummary.releaseYear,
  });

  if (detailedReleaseLabel) {
    return detailedReleaseLabel;
  }

  return {
    label: 'Jaar',
    value: setSummary.releaseYear,
  };
}

function CatalogSetCardVisualBadges({
  contextBadge,
  savedState,
  showThemeBadge = true,
  theme,
}: {
  contextBadge?: CatalogSetCardContextBadge;
  savedState?: CatalogSetSavedState;
  showThemeBadge?: boolean;
  theme: string;
}) {
  if (!showThemeBadge && !contextBadge && !savedState) {
    return null;
  }

  return (
    <div className={styles.cardVisualBadgeCluster}>
      {showThemeBadge ? (
        <Badge className={styles.cardThemeBadge} tone="neutral">
          <CatalogCanonicalText>{theme}</CatalogCanonicalText>
        </Badge>
      ) : null}
      {contextBadge ? (
        <Badge tone={contextBadge.tone ?? 'neutral'}>
          {contextBadge.label}
        </Badge>
      ) : null}
      {savedState ? (
        <Badge tone={getSavedStateBadgeTone(savedState)}>
          {getSavedStateLabel(savedState)}
        </Badge>
      ) : null}
    </div>
  );
}

function CatalogSetCardClickLayer({
  href,
  label,
  trackingEvent,
}: {
  href?: string;
  label: string;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
}) {
  if (!href) {
    return null;
  }

  return (
    <ActionLink
      aria-label={label}
      className={styles.setCardClickLayer}
      data-catalog-set-card-click-layer="true"
      href={href}
      tone="card"
      {...buildBrickhuntAnalyticsAttributes(trackingEvent)}
    >
      <VisuallyHidden>{label}</VisuallyHidden>
    </ActionLink>
  );
}

function formatCompactBrowsePrice(priceLabel: string): string {
  return priceLabel.replace(/^Vanaf\s+/u, '').trim();
}

function formatMinifigureCount(minifigureCount?: number): string {
  if (typeof minifigureCount !== 'number') {
    return 'Nog niet bekend';
  }

  return minifigureCount.toLocaleString();
}

function formatCatalogRecommendedAge(
  recommendedAge?: number,
): string | undefined {
  if (
    typeof recommendedAge !== 'number' ||
    !Number.isInteger(recommendedAge) ||
    recommendedAge <= 0
  ) {
    return undefined;
  }

  return `${recommendedAge}+`;
}

function buildCatalogSetDetailHeroFacts({
  catalogSetDetail,
  themeHref,
}: {
  catalogSetDetail: CatalogSetDetail;
  themeHref?: string;
}): CatalogKeyFact[] {
  const heroFacts: CatalogKeyFact[] = [];
  const recommendedAgeLabel = formatCatalogRecommendedAge(
    catalogSetDetail.recommendedAge,
  );

  if (recommendedAgeLabel) {
    heroFacts.push({
      id: 'recommended-age',
      label: 'Leeftijd',
      value: recommendedAgeLabel,
    });
  }

  if (catalogSetDetail.pieces > 0) {
    heroFacts.push({
      id: 'piece-count',
      label: 'Stenen',
      value: catalogSetDetail.pieces.toLocaleString('nl-NL'),
    });
  }

  if (
    typeof catalogSetDetail.minifigureCount === 'number' &&
    catalogSetDetail.minifigureCount > 0
  ) {
    heroFacts.push({
      id: 'minifigures',
      label: 'Minifiguren',
      value: formatMinifigureCount(catalogSetDetail.minifigureCount),
    });
  }

  if (catalogSetDetail.releaseYear > 0) {
    heroFacts.push({
      id: 'release',
      label:
        catalogSetDetail.releaseYear >= new Date().getUTCFullYear()
          ? 'Nieuw'
          : 'Release',
      value: catalogSetDetail.releaseYear,
    });
  }

  if (!catalogSetDetail.publicTheme?.logoUrl) {
    return heroFacts;
  }

  const themeName = catalogSetDetail.publicTheme.name || catalogSetDetail.theme;
  const themeLogo = (
    <img
      alt={`${themeName} logo`}
      className={styles.heroThemeLogo}
      decoding="async"
      height={96}
      loading="lazy"
      src={catalogSetDetail.publicTheme.logoUrl}
      width={296}
    />
  );
  const validThemeHref = isCatalogThemeHref(themeHref) ? themeHref : undefined;

  return [
    {
      id: 'theme-logo',
      label: <VisuallyHidden>Thema</VisuallyHidden>,
      value: (
        <span
          className={styles.heroThemeLogoValue}
          data-theme-logo-slug={catalogSetDetail.publicTheme.slug}
        >
          {validThemeHref ? (
            <a
              aria-label={`Bekijk ${themeName}`}
              className={styles.heroThemeLogoLink}
              href={validThemeHref}
            >
              {themeLogo}
            </a>
          ) : (
            themeLogo
          )}
        </span>
      ),
    },
    ...heroFacts,
  ];
}

function isCatalogThemeHref(href?: string): href is string {
  return typeof href === 'string' && /^\/themes\/[^/\s]+$/.test(href);
}

function getCatalogThemeStyleVariables({
  visual,
}: {
  visual?: CatalogThemeVisual;
}): CSSProperties | undefined {
  const resolvedVisual = visual;

  if (!resolvedVisual?.backgroundColor && !resolvedVisual?.textColor) {
    return undefined;
  }

  const themeCardForeground = getAccessibleCatalogCardForeground(
    resolvedVisual.backgroundColor,
    resolvedVisual.textColor,
  );
  const themeCardSurface = getAccessibleCatalogCardSurface(
    resolvedVisual.backgroundColor,
    themeCardForeground,
  );
  const themeBadgeText = getAccessibleCatalogTextColor(
    resolvedVisual.backgroundColor,
    resolvedVisual.textColor,
  );

  return {
    ...(resolvedVisual.backgroundColor
      ? ({
          '--card-theme-badge-accent': resolvedVisual.backgroundColor,
          '--catalog-theme-badge-surface': resolvedVisual.backgroundColor,
          '--card-theme-badge-bg': resolvedVisual.backgroundColor,
          '--theme-surface': themeCardSurface ?? resolvedVisual.backgroundColor,
        } as CSSProperties)
      : {}),
    ...(themeBadgeText
      ? ({
          '--catalog-theme-badge-text': themeBadgeText,
          '--card-theme-badge-text': themeBadgeText,
        } as CSSProperties)
      : {}),
    ...(themeCardForeground
      ? ({
          '--theme-card-foreground': themeCardForeground,
          '--theme-text': themeCardForeground,
          '--theme-muted': themeCardForeground,
        } as CSSProperties)
      : {}),
  };
}

function getAccessibleCatalogCardForeground(
  backgroundColor?: string,
  preferredTextColor?: string,
): string | undefined {
  const darkContrast = getCatalogColorContrastRatio(
    CATALOG_A11Y_TEXT_DARK,
    backgroundColor,
  );
  const lightContrast = getCatalogColorContrastRatio(
    CATALOG_A11Y_TEXT_LIGHT,
    backgroundColor,
  );

  if (typeof darkContrast === 'number' && typeof lightContrast === 'number') {
    if (
      darkContrast < CATALOG_A11Y_CONTRAST_AA &&
      lightContrast < CATALOG_A11Y_CONTRAST_AA
    ) {
      return darkContrast >= lightContrast
        ? CATALOG_A11Y_TEXT_DARK
        : CATALOG_A11Y_TEXT_LIGHT;
    }

    return darkContrast >= lightContrast
      ? CATALOG_A11Y_TEXT_DARK
      : CATALOG_A11Y_TEXT_LIGHT;
  }

  return preferredTextColor;
}

function getAccessibleCatalogCardSurface(
  backgroundColor?: string,
  foregroundColor?: string,
): string | undefined {
  const currentContrast = getCatalogColorContrastRatio(
    foregroundColor,
    backgroundColor,
  );

  if (
    !backgroundColor ||
    !foregroundColor ||
    typeof currentContrast !== 'number' ||
    currentContrast >= CATALOG_A11Y_CONTRAST_AA
  ) {
    return backgroundColor;
  }

  const background = parseCatalogHexColor(backgroundColor);
  const foreground = parseCatalogHexColor(foregroundColor);

  if (!background || !foreground) {
    return backgroundColor;
  }

  const foregroundIsDark =
    getCatalogRelativeLuminance(foreground) <
    getCatalogRelativeLuminance([255, 255, 255]);
  const target: [red: number, green: number, blue: number] = foregroundIsDark
    ? [255, 255, 255]
    : [0, 0, 0];

  for (const blendAmount of [0.04, 0.08, 0.12, 0.16, 0.2, 0.24]) {
    const adjustedBackground = blendCatalogRgbColor(
      background,
      target,
      blendAmount,
    );
    const adjustedBackgroundHex = formatCatalogHexColor(adjustedBackground);
    const adjustedContrast = getCatalogColorContrastRatio(
      foregroundColor,
      adjustedBackgroundHex,
    );

    if (
      typeof adjustedContrast === 'number' &&
      adjustedContrast >= CATALOG_A11Y_CONTRAST_AA
    ) {
      return adjustedBackgroundHex;
    }
  }

  return backgroundColor;
}

function getAccessibleCatalogTextColor(
  backgroundColor?: string,
  preferredTextColor?: string,
): string | undefined {
  const preferredContrast = getCatalogColorContrastRatio(
    preferredTextColor,
    backgroundColor,
  );

  if (
    typeof preferredContrast === 'number' &&
    preferredContrast >= CATALOG_A11Y_CONTRAST_AA
  ) {
    return preferredTextColor;
  }

  const darkContrast = getCatalogColorContrastRatio(
    CATALOG_A11Y_TEXT_DARK,
    backgroundColor,
  );
  const lightContrast = getCatalogColorContrastRatio(
    CATALOG_A11Y_TEXT_LIGHT,
    backgroundColor,
  );

  if (typeof darkContrast !== 'number' || typeof lightContrast !== 'number') {
    return preferredTextColor;
  }

  return darkContrast >= lightContrast
    ? CATALOG_A11Y_TEXT_DARK
    : CATALOG_A11Y_TEXT_LIGHT;
}

function getCatalogColorContrastRatio(
  foregroundColor?: string,
  backgroundColor?: string,
): number | undefined {
  const foreground = parseCatalogHexColor(foregroundColor);
  const background = parseCatalogHexColor(backgroundColor);

  if (!foreground || !background) {
    return undefined;
  }

  const foregroundLuminance = getCatalogRelativeLuminance(foreground);
  const backgroundLuminance = getCatalogRelativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function parseCatalogHexColor(
  color?: string,
): [red: number, green: number, blue: number] | undefined {
  const normalizedColor = color?.trim().toLowerCase();

  if (!normalizedColor) {
    return undefined;
  }

  const shortHexMatch = normalizedColor.match(
    /^#([0-9a-f])([0-9a-f])([0-9a-f])$/u,
  );

  if (shortHexMatch) {
    return [
      parseInt(`${shortHexMatch[1]}${shortHexMatch[1]}`, 16),
      parseInt(`${shortHexMatch[2]}${shortHexMatch[2]}`, 16),
      parseInt(`${shortHexMatch[3]}${shortHexMatch[3]}`, 16),
    ];
  }

  const hexMatch = normalizedColor.match(
    /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/u,
  );

  if (!hexMatch) {
    return undefined;
  }

  return [
    parseInt(hexMatch[1], 16),
    parseInt(hexMatch[2], 16),
    parseInt(hexMatch[3], 16),
  ];
}

function getCatalogRelativeLuminance([red, green, blue]: [
  red: number,
  green: number,
  blue: number,
]): number {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map(
    (channel) => {
      const normalizedChannel = channel / 255;

      return normalizedChannel <= 0.03928
        ? normalizedChannel / 12.92
        : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
    },
  );

  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

function blendCatalogRgbColor(
  from: [red: number, green: number, blue: number],
  to: [red: number, green: number, blue: number],
  amount: number,
): [red: number, green: number, blue: number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

function formatCatalogHexColor([red, green, blue]: [
  red: number,
  green: number,
  blue: number,
]): string {
  return `#${[red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function getCatalogPublicThemeVisual(
  publicTheme?: CatalogPublicThemeReference,
): CatalogThemeVisual | undefined {
  const backgroundColor = publicTheme?.surfaceColor ?? publicTheme?.accentColor;
  const textColor = publicTheme?.surfaceTextColor ?? publicTheme?.heroTextColor;

  if (!backgroundColor && !textColor) {
    return undefined;
  }

  return {
    backgroundColor,
    textColor,
  };
}

export function CatalogSetCard({
  actions,
  ctaMode = 'default',
  contextBadge,
  href,
  imageFetchPriority,
  imageLoading,
  priceContext,
  priceDisplay = 'default',
  savedState,
  setSummary,
  showThemeBadge = true,
  supportingNote,
  trackingEvent,
  variant = 'default',
  visualActions,
}: {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  contextBadge?: CatalogSetCardContextBadge;
  href?: string;
  imageFetchPriority?: 'auto' | 'high' | 'low';
  imageLoading?: 'eager' | 'lazy';
  priceContext?: CatalogSetCardPriceContext;
  priceDisplay?: CatalogSetCardPriceDisplay;
  savedState?: CatalogSetSavedState;
  setSummary: CatalogSetCardSummary;
  showThemeBadge?: boolean;
  supportingNote?: ReactNode;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  variant?: CatalogSetCardVariant;
  visualActions?: ReactNode;
}) {
  const primaryAction = getCardPrimaryActionConfig({
    ctaMode,
    href,
    priceContext,
    trackingEvent,
    variant,
  });
  const PrimaryActionIcon = primaryAction.icon;
  const setThemeSlug = buildCatalogThemeSlug(setSummary.theme);
  const setThemeStyle = getCatalogThemeStyleVariables({
    visual: getCatalogPublicThemeVisual(setSummary.publicTheme),
  });
  const cardImageUrl = getCatalogSetCardImageUrl(setSummary);
  const hasSupportingContext = Boolean(
    (priceContext && priceDisplay === 'subtle') || supportingNote,
  );

  if (variant === 'compact') {
    const compactUsesDecisionZone = Boolean(actions);
    const overlayBadges = (
      <CatalogSetCardVisualBadges
        contextBadge={contextBadge}
        savedState={savedState}
        showThemeBadge={showThemeBadge}
        theme={setSummary.theme}
      />
    );
    const browseCardContent = (
      <>
        <CatalogSetVisual
          imageFetchPriority={imageFetchPriority}
          imageLoading={imageLoading}
          imageUrl={cardImageUrl}
          name={setSummary.name}
          overlayBadges={overlayBadges}
          overlayControls={visualActions}
          setId={setSummary.id}
          theme={setSummary.theme}
          variant="card"
        />
        <div className={styles.cardCompactBody}>
          <CatalogSetFactRow
            className={styles.cardCompactSupportingSlot}
            setSummary={setSummary}
          />
          <h3 className={`${styles.cardTitle} ${styles.cardTitleClamp}`}>
            <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
          </h3>
          <div
            aria-hidden={priceContext ? undefined : 'true'}
            className={`${styles.cardCompactBrowsePrice} ${
              priceContext ? '' : styles.cardCompactBrowsePriceEmpty
            }`.trim()}
          >
            {priceContext ? (
              <p className={styles.cardCompactBrowsePriceValue}>
                <VisuallyHidden>Vanaf </VisuallyHidden>
                {formatCompactBrowsePrice(priceContext.currentPrice)}
              </p>
            ) : null}
          </div>
          {!compactUsesDecisionZone ? (
            <div className={styles.cardCompactFooter}>
              {href ? (
                <span
                  aria-hidden="true"
                  className={`${styles.cardCompactAction} ${styles.cardCompactPrimaryAction} ${primaryAction.className}`}
                  title={primaryAction.ariaLabel}
                >
                  <PrimaryActionIcon
                    aria-hidden="true"
                    className={styles.cardCompactActionIcon}
                  />
                  <span className={styles.cardCompactActionLabel}>
                    {primaryAction.label}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </>
    );

    return (
      <Surface
        as="article"
        className={`${styles.setCard} ${styles.setCardCompact}`}
        data-catalog-set-card="true"
        data-catalog-set-card-variant={variant}
        data-theme={setThemeSlug}
        style={setThemeStyle}
      >
        <CatalogSetCardClickLayer
          href={href}
          label={`Bekijk ${setSummary.name}`}
          trackingEvent={trackingEvent}
        />
        <div className={styles.setCardLink} data-catalog-set-card-link="true">
          {browseCardContent}
        </div>
        {compactUsesDecisionZone ? (
          <div className={styles.cardCompactDecisionZone}>
            <div className={styles.cardCompactFooterActions}>
              {primaryAction.href ? (
                <ActionLink
                  aria-label={primaryAction.ariaLabel}
                  className={`${styles.cardCompactAction} ${styles.cardCompactPrimaryAction} ${primaryAction.className}`}
                  href={primaryAction.href}
                  rel={primaryAction.rel}
                  target={primaryAction.target}
                  title={primaryAction.ariaLabel}
                  tone="card"
                  {...buildBrickhuntAnalyticsAttributes(
                    primaryAction.trackingEvent,
                  )}
                >
                  <PrimaryActionIcon
                    aria-hidden="true"
                    className={styles.cardCompactActionIcon}
                  />
                  <span className={styles.cardCompactActionLabel}>
                    {primaryAction.label}
                  </span>
                </ActionLink>
              ) : null}
              {actions ? (
                <div className={styles.cardCompactSecondaryAction}>
                  {actions}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Surface>
    );
  }

  if (variant === 'featured') {
    const featuredMerchantLabel = priceContext
      ? (priceContext.decisionNote ??
        getCardMerchantLabel(priceContext.merchantLabel))
      : null;
    const featuredDealValueLine = priceContext
      ? buildCompactDealValueLine(priceContext)
      : undefined;
    const overlayBadges = (
      <CatalogSetCardVisualBadges
        contextBadge={contextBadge}
        savedState={savedState}
        showThemeBadge={showThemeBadge}
        theme={setSummary.theme}
      />
    );

    const featuredCardContent = (
      <>
        <CatalogSetVisual
          imageFetchPriority={imageFetchPriority}
          imageLoading={imageLoading}
          imageUrl={cardImageUrl}
          name={setSummary.name}
          overlayBadges={overlayBadges}
          overlayControls={visualActions}
          setId={setSummary.id}
          theme={setSummary.theme}
          variant="card"
        />
        <div className={`${styles.cardCompactBody} ${styles.featuredCardBody}`}>
          <CatalogSetFactRow
            className={styles.cardFeaturedSupportingSlot}
            setSummary={setSummary}
          />
          <h3 className={`${styles.cardTitle} ${styles.cardTitleClamp}`}>
            <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
          </h3>
          <div className={styles.priceCompactBlock}>
            {priceContext ? (
              <>
                <p
                  className={`${styles.cardCompactBrowsePriceValue} ${styles.featuredPriceValue}`}
                >
                  <VisuallyHidden>Vanaf </VisuallyHidden>
                  {formatCompactBrowsePrice(priceContext.currentPrice)}
                </p>
                {featuredDealValueLine ? (
                  <p
                    className={styles.discountMetric}
                    data-catalog-discount-metric="true"
                  >
                    {featuredDealValueLine}
                  </p>
                ) : null}
                <p className={styles.cardCompactSupporting}>
                  {featuredMerchantLabel}
                </p>
              </>
            ) : (
              <p className={styles.priceQuietState}>Prijs volgt</p>
            )}
          </div>
        </div>
      </>
    );

    return (
      <Surface
        as="article"
        className={`${styles.setCard} ${styles.setCardCompact}`}
        data-catalog-set-card="true"
        data-catalog-set-card-variant={variant}
        data-theme={setThemeSlug}
        style={setThemeStyle}
      >
        <CatalogSetCardClickLayer
          href={href}
          label={`Bekijk ${setSummary.name}`}
          trackingEvent={trackingEvent}
        />
        <div className={styles.setCardLink} data-catalog-set-card-link="true">
          {featuredCardContent}
        </div>
        {primaryAction.href || actions ? (
          <div className={styles.cardCompactDecisionZone}>
            <div className={styles.cardCompactFooterActions}>
              {primaryAction.href ? (
                <ActionLink
                  aria-label={primaryAction.ariaLabel}
                  className={`${styles.cardCompactAction} ${styles.cardCompactPrimaryAction} ${primaryAction.className}`}
                  href={primaryAction.href}
                  rel={primaryAction.rel}
                  target={primaryAction.target}
                  title={primaryAction.ariaLabel}
                  tone="card"
                  {...buildBrickhuntAnalyticsAttributes(
                    primaryAction.trackingEvent,
                  )}
                >
                  <PrimaryActionIcon
                    aria-hidden="true"
                    className={styles.cardCompactActionIcon}
                  />
                  <span className={styles.cardCompactActionLabel}>
                    {primaryAction.label}
                  </span>
                </ActionLink>
              ) : null}
              {actions ? (
                <div className={styles.cardCompactSecondaryAction}>
                  {actions}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Surface>
    );
  }

  return (
    <Surface
      as="article"
      className={styles.setCard}
      data-catalog-set-card="true"
      data-catalog-set-card-variant={variant}
      data-theme={setThemeSlug}
      style={setThemeStyle}
    >
      <CatalogSetVisual
        imageFetchPriority={imageFetchPriority}
        imageLoading={imageLoading}
        imageUrl={cardImageUrl}
        name={setSummary.name}
        overlayControls={visualActions}
        setId={setSummary.id}
        theme={setSummary.theme}
        variant="card"
      />
      <div className={styles.cardHeader}>
        <div className={styles.cardMetaRow}>
          <Badge className={styles.cardThemeBadge} tone="neutral">
            <CatalogCanonicalText>{setSummary.theme}</CatalogCanonicalText>
          </Badge>
          {contextBadge ? (
            <Badge tone={contextBadge.tone ?? 'neutral'}>
              {contextBadge.label}
            </Badge>
          ) : null}
          {savedState ? (
            <Badge tone={getSavedStateBadgeTone(savedState)}>
              {getSavedStateLabel(savedState)}
            </Badge>
          ) : null}
          <p className={styles.cardMetaText}>
            {getCatalogSetCardReleaseMetaValue(setSummary)} ·{' '}
            {setSummary.pieces.toLocaleString('nl-NL')} stenen
          </p>
        </div>
        <h3 className={`${styles.cardTitle} ${styles.cardTitleClamp}`}>
          <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
        </h3>
      </div>
      {priceContext && priceDisplay === 'default' ? (
        <div className={styles.priceBlock}>
          <p className={styles.priceLabel}>Reviewed prijs</p>
          <p className={styles.priceValue}>{priceContext.currentPrice}</p>
          {priceContext.discountMetric ? (
            <p
              className={styles.discountMetric}
              data-catalog-discount-metric="true"
            >
              {priceContext.discountMetric}
            </p>
          ) : null}
          {priceContext.dealReason &&
          !isDuplicatePriceContextLine(
            priceContext.dealReason,
            priceContext.discountMetric,
          ) ? (
            <p className={styles.dealReason}>{priceContext.dealReason}</p>
          ) : null}
          <p className={styles.priceMeta}>
            {priceContext.decisionNote ?? priceContext.merchantLabel}
          </p>
          {(priceContext.decisionLabel ?? priceContext.pricePositionLabel) ? (
            <p className={styles.pricePosition}>
              {priceContext.decisionLabel ?? priceContext.pricePositionLabel}
            </p>
          ) : null}
          <div className={styles.supportingGrid}>
            <CatalogSupportingDetail
              label="Dekking"
              tone="muted"
              value={priceContext.coverageLabel}
            />
            <CatalogSupportingDetail
              label="Actualiteit"
              tone="muted"
              value={priceContext.reviewedLabel}
            />
          </div>
        </div>
      ) : priceDisplay === 'default' ? (
        <div className={styles.priceBlock}>
          <p className={styles.priceLabel}>Reviewed prijs</p>
          <p className={styles.priceUnavailableCopy}>
            Reviewed prijs nog niet gepubliceerd.
          </p>
        </div>
      ) : null}
      {hasSupportingContext ? (
        <div className={styles.collectorContext}>
          {priceContext && priceDisplay === 'subtle' ? (
            <CatalogSupportingDetail
              label="Huidige reviewed prijs"
              tone="muted"
              value={`${priceContext.currentPrice} · ${
                priceContext.decisionNote ?? priceContext.merchantLabel
              }`}
            />
          ) : null}
          {supportingNote ? (
            <CatalogSupportingDetail
              label={
                priceContext && priceDisplay === 'default'
                  ? 'Koopsignaal'
                  : 'Huidige marktnotitie'
              }
              value={supportingNote}
            />
          ) : null}
        </div>
      ) : null}
      <CatalogSetMetadata
        items={[
          { label: 'Steentjes', value: setSummary.pieces.toLocaleString() },
          getCatalogSetMetadataReleaseItem(setSummary),
        ]}
      />
      {actions || href ? (
        <div className={styles.cardActions}>
          {href ? (
            <ActionLink
              className={styles.actionLink}
              href={href}
              tone="secondary"
              {...buildBrickhuntAnalyticsAttributes(trackingEvent)}
            >
              Bekijk set
            </ActionLink>
          ) : null}
          {actions}
        </div>
      ) : null}
    </Surface>
  );
}

function getCatalogGalleryImages(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'imageUrl' | 'images' | 'primaryImage'
  >,
): readonly CatalogSetImage[] {
  return (
    normalizeCatalogSetImages({
      imageUrl: catalogSetDetail.imageUrl,
      images: catalogSetDetail.images,
      primaryImage: catalogSetDetail.primaryImage,
    }).images?.filter(
      (image) => image.type !== 'social' && image.type !== 'thumbnail',
    ) ?? []
  );
}

function getCatalogSetImageAspectRatio(
  catalogSetImage: Pick<CatalogSetImage, 'height' | 'width'>,
): number | undefined {
  if (
    typeof catalogSetImage.width !== 'number' ||
    !Number.isFinite(catalogSetImage.width) ||
    catalogSetImage.width <= 0 ||
    typeof catalogSetImage.height !== 'number' ||
    !Number.isFinite(catalogSetImage.height) ||
    catalogSetImage.height <= 0
  ) {
    return undefined;
  }

  return catalogSetImage.width / catalogSetImage.height;
}

function getCatalogSetImageOrientation(
  catalogSetImage: Pick<CatalogSetImage, 'height' | 'width'>,
): CarouselImage['orientation'] | undefined {
  const aspectRatio = getCatalogSetImageAspectRatio(catalogSetImage);

  if (!aspectRatio) {
    return undefined;
  }

  if (aspectRatio > 1.08) {
    return 'landscape';
  }

  if (aspectRatio < 0.92) {
    return 'portrait';
  }

  return 'square';
}

function createCatalogGalleryImageItems(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'id' | 'imageUrl' | 'images' | 'name' | 'primaryImage'
  >,
): readonly CarouselImage[] {
  return getCatalogGalleryImages(catalogSetDetail).map(
    (catalogSetImage, index) => {
      const aspectRatio = getCatalogSetImageAspectRatio(catalogSetImage);

      return {
        alt:
          index === 0
            ? `${catalogSetDetail.name} LEGO-set`
            : `${catalogSetDetail.name} LEGO-set afbeelding ${index + 1}`,
        ...(aspectRatio
          ? {
              aspectRatio,
              height: catalogSetImage.height,
              orientation: getCatalogSetImageOrientation(catalogSetImage),
              width: catalogSetImage.width,
            }
          : {}),
        ...(catalogSetImage.attributionText
          ? {
              caption: catalogSetImage.attributionText,
            }
          : {}),
        src: catalogSetImage.url,
        ...(catalogSetImage.thumbnailUrl
          ? {
              thumbnailSrc: catalogSetImage.thumbnailUrl,
            }
          : {}),
      };
    },
  );
}

function CatalogSetImageGallery({
  catalogSetDetail,
}: {
  catalogSetDetail: CatalogSetDetail;
}) {
  const catalogGalleryImages = getCatalogGalleryImages(catalogSetDetail);
  const galleryImages = createCatalogGalleryImageItems(catalogSetDetail);
  const attributionTexts = [
    ...new Set(
      catalogGalleryImages.flatMap((image) =>
        image.attributionText ? [image.attributionText] : [],
      ),
    ),
  ];

  if (!galleryImages.length) {
    return (
      <CatalogSetVisual
        imageUrl={catalogSetDetail.primaryImage ?? catalogSetDetail.imageUrl}
        name={catalogSetDetail.name}
        setId={catalogSetDetail.id}
        theme={catalogSetDetail.theme}
        variant="hero"
      />
    );
  }

  return (
    <div className={styles.setImageGalleryWithAttribution}>
      <ImageGallery
        ariaLabel={`Afbeeldingen van ${catalogSetDetail.name}`}
        detailMobileFullBleed
        images={galleryImages}
        variant="detail"
      />
      {attributionTexts.length ? (
        <p className={styles.setImageGalleryAttribution}>
          {attributionTexts.join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

function formatCatalogSetDetailReviewCount(reviewCount: number): string {
  return `(${reviewCount.toLocaleString('nl-NL')})`;
}

function CatalogSetDetailHeroRating({
  summary,
}: {
  summary: CatalogSetDetailReviewSummary;
}) {
  const averageRating =
    typeof summary.averageRating === 'number' &&
    Number.isFinite(summary.averageRating)
      ? summary.averageRating
      : 0;
  const roundedRating = Math.round(averageRating);
  const label =
    summary.reviewCount > 0
      ? `${averageRating.toLocaleString('nl-NL', {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })} van 5 sterren, ${summary.reviewCount.toLocaleString(
          'nl-NL',
        )} beoordelingen`
      : 'Nog geen score, 0 beoordelingen';

  return (
    <CatalogSetDetailReviewLink
      aria-label={`${label}. Ga naar Productbeoordelingen.`}
      className={styles.detailHeroRatingLink}
      href={`#${PRODUCT_REVIEWS_SECTION_ID}`}
    >
      <span aria-hidden="true" className={styles.detailHeroRatingStars}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <Star
            className={joinClassNames(
              styles.detailHeroRatingStar,
              rating <= roundedRating && styles.detailHeroRatingStarFilled,
            )}
            key={rating}
          />
        ))}
      </span>
      <span className={styles.detailHeroRatingCount}>
        {formatCatalogSetDetailReviewCount(summary.reviewCount)}
      </span>
      {summary.reviewCount === 0 ? (
        <span className={styles.detailHeroRatingNoScore}>
          Nog geen beoordelingen
        </span>
      ) : null}
    </CatalogSetDetailReviewLink>
  );
}

function CatalogSetOwnershipCard({ action }: { action?: ReactNode }) {
  if (!action) {
    return null;
  }

  return (
    <Panel
      as="section"
      className={styles.ownershipCard}
      description="Vink deze set af als hij al op je plank staat."
      elevation="rested"
      title="Al in huis?"
      tone="muted"
    >
      <div className={styles.ownershipAction}>{action}</div>
    </Panel>
  );
}

function CatalogSetSupportCard({
  items,
  title,
}: {
  items: readonly CatalogSetDetailSupportItem[];
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Panel
      as="section"
      className={styles.supportCard}
      elevation="rested"
      title={title}
      tone="muted"
    >
      <MarkerList
        className={styles.supportList}
        items={items.map((item) => ({
          content: item.text,
          id: item.id,
        }))}
      />
    </Panel>
  );
}

function getCatalogProductDescriptionBlocks(description: string): Array<
  | {
      items: string[];
      type: 'list';
      variant: 'ol' | 'ul';
    }
  | {
      content: string;
      type: 'paragraph';
    }
> {
  const blocks: Array<
    | {
        items: string[];
        type: 'list';
        variant: 'ol' | 'ul';
      }
    | {
        content: string;
        type: 'paragraph';
      }
  > = [];
  const pushTextLinesAsBlocks = (content: string) => {
    const lines = content
      .split(/<br>|\n/gi)
      .map((line) => line.trim())
      .filter(Boolean);
    const paragraphLines: string[] = [];
    const listItems: string[] = [];
    const flushParagraph = () => {
      if (paragraphLines.length > 0) {
        blocks.push({
          content: paragraphLines.join('<br>'),
          type: 'paragraph',
        });
        paragraphLines.length = 0;
      }
    };
    const flushList = () => {
      if (listItems.length > 0) {
        blocks.push({
          items: [...listItems],
          type: 'list',
          variant: 'ul',
        });
        listItems.length = 0;
      }
    };

    for (const line of lines) {
      const bulletMatch = line.match(/^(?:[-*•])\s*(.+)$/);

      if (bulletMatch) {
        flushParagraph();
        listItems.push(bulletMatch[1].trim());
      } else {
        flushList();
        paragraphLines.push(line);
      }
    }

    flushParagraph();
    flushList();
  };
  const htmlBlocks = Array.from(
    description.matchAll(/<(p|ul|ol)>([\s\S]*?)<\/\1>/gi),
  );

  if (!htmlBlocks.length) {
    pushTextLinesAsBlocks(description);

    return blocks;
  }

  for (const [, tagName, content] of htmlBlocks) {
    const normalizedTagName = tagName.toLowerCase();

    if (normalizedTagName === 'ul' || normalizedTagName === 'ol') {
      const listVariant: 'ol' | 'ul' = normalizedTagName;
      const items = Array.from(content.matchAll(/<li>([\s\S]*?)<\/li>/gi))
        .map(([, item]) => item.trim())
        .filter(Boolean);

      if (items.length > 0) {
        blocks.push({
          items,
          type: 'list' as const,
          variant: listVariant,
        });
      }

      continue;
    }

    pushTextLinesAsBlocks(content);
  }

  return blocks;
}

function renderCatalogProductDescriptionInlineContent(
  content: string,
  keyPrefix: string,
): ReactNode[] {
  return content.split(/<br>/gi).flatMap((line, lineIndex) => {
    const inlineNodes: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of line.matchAll(/<(strong|em)>([\s\S]*?)<\/\1>/gi)) {
      const [fullMatch, tagName, text] = match;
      const matchIndex = match.index ?? 0;

      if (matchIndex > lastIndex) {
        inlineNodes.push(line.slice(lastIndex, matchIndex));
      }

      inlineNodes.push(
        tagName.toLowerCase() === 'strong' ? (
          <strong key={`${keyPrefix}-strong-${matchIndex}`}>{text}</strong>
        ) : (
          <em key={`${keyPrefix}-em-${matchIndex}`}>{text}</em>
        ),
      );
      lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < line.length) {
      inlineNodes.push(line.slice(lastIndex));
    }

    if (lineIndex === 0) {
      return inlineNodes;
    }

    return [<br key={`${keyPrefix}-br-${lineIndex}`} />, ...inlineNodes];
  });
}

export function CatalogSetProductDescription({
  description,
  imageAlt,
  imageUrl,
}: {
  description?: string;
  imageAlt?: string;
  imageUrl?: string;
}) {
  const trimmedDescription = description?.trim();

  if (!trimmedDescription) {
    return null;
  }

  const blocks = getCatalogProductDescriptionBlocks(trimmedDescription);

  if (!blocks.length) {
    return null;
  }

  return (
    <DetailAccordionSection
      className={styles.detailProductDescriptionSection}
      contentClassName={styles.productDescriptionLayout}
      title="Productgegevens"
    >
      {imageUrl ? (
        <div className={styles.productDescriptionVisual}>
          <img
            alt={imageAlt ?? 'LEGO setbeeld'}
            className={styles.productDescriptionImage}
            decoding="async"
            loading="lazy"
            src={imageUrl}
          />
        </div>
      ) : null}
      <div className={styles.productDescriptionBody}>
        {blocks.map((block, blockIndex) =>
          block.type === 'list' ? (
            block.variant === 'ol' ? (
              <ol
                className={styles.productDescriptionList}
                key={`list-${blockIndex}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${blockIndex}-${itemIndex}`}>
                    {renderCatalogProductDescriptionInlineContent(
                      item,
                      `${blockIndex}-${itemIndex}`,
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <ul
                className={styles.productDescriptionList}
                key={`list-${blockIndex}`}
              >
                {block.items.map((item, itemIndex) => (
                  <li key={`${blockIndex}-${itemIndex}`}>
                    {renderCatalogProductDescriptionInlineContent(
                      item,
                      `${blockIndex}-${itemIndex}`,
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p
              className={styles.productDescriptionParagraph}
              key={`paragraph-${blockIndex}`}
            >
              {renderCatalogProductDescriptionInlineContent(
                block.content,
                `${blockIndex}`,
              )}
            </p>
          ),
        )}
      </div>
    </DetailAccordionSection>
  );
}

export function CatalogSetProductFeatures({
  features,
}: {
  features?: readonly CatalogProductFeature[];
}) {
  const safeFeatures =
    features?.filter((feature) => feature.body.trim().length > 0) ?? [];

  if (safeFeatures.length < 2) {
    return null;
  }

  return (
    <DetailAccordionSection
      className={styles.detailProductDescriptionSection}
      contentClassName={styles.productFeaturesLayout}
      title="Productkenmerken"
    >
      <ul className={styles.productFeaturesList}>
        {safeFeatures.map((feature, index) => (
          <li className={styles.productFeaturesItem} key={index}>
            {feature.title ? (
              <>
                <strong>{feature.title}</strong>
                <span aria-hidden="true"> - </span>
              </>
            ) : null}
            <span>{feature.body}</span>
          </li>
        ))}
      </ul>
    </DetailAccordionSection>
  );
}

export function CatalogSetDetailPanel({
  bestDeal,
  brickhuntValueItems = [],
  catalogSetDetail,
  dealSupportItems = [],
  dealVerdict,
  followCopy,
  followTitle,
  offerList = [],
  offerSummaryLabel,
  heroCtaSideAction,
  ownershipActions,
  priceAlertAction,
  priceHistoryPanel,
  productReviewsSlot,
  recentlyViewedRail,
  reviewSummary,
  setDetailHref,
  similarSetsRail,
  setNewsRail,
  themeDirectoryHref,
  themeHref,
  trustSignals = [],
}: {
  bestDeal?: CatalogSetDetailBestDeal;
  brickhuntValueItems?: readonly CatalogSetDetailSupportItem[];
  catalogSetDetail: CatalogSetDetail;
  dealSupportItems?: readonly CatalogSetDetailSupportItem[];
  dealVerdict: CatalogSetDetailVerdict;
  followCopy?: string;
  followEyebrow?: string;
  followTitle?: string;
  heroCtaSideAction?: ReactNode;
  offerList?: readonly CatalogSetDetailOfferItem[];
  offerSummaryLabel?: string;
  ownershipActions?: ReactNode;
  priceAlertAction?: ReactNode;
  priceHistoryPanel?: ReactNode;
  productReviewsSlot?: ReactNode;
  recentlyViewedRail?: ReactNode;
  reviewSummary?: CatalogSetDetailReviewSummary;
  setDetailHref?: string;
  similarSetsRail?: ReactNode;
  setNewsRail?: ReactNode;
  themeDirectoryHref?: string;
  themeHref?: string;
  trustSignals?: readonly CatalogSetDetailTrustSignal[];
}) {
  const heroSpecs = buildCatalogSetDetailHeroFacts({
    catalogSetDetail,
    themeHref,
  });
  const visibleTitle = getCatalogSetVisibleTitle(catalogSetDetail);
  const offerComparisonSectionId = 'set-offers';
  const themeBadgeStyle = getCatalogThemeStyleVariables({
    visual: getCatalogPublicThemeVisual(catalogSetDetail.publicTheme),
  });
  const hasFollowModule = Boolean(
    priceAlertAction || followCopy || followTitle,
  );
  const shouldLeadHeroWithFollowAction = Boolean(
    priceAlertAction && !bestDeal?.ctaHref,
  );
  const secondaryPriceAlertAction = shouldLeadHeroWithFollowAction
    ? undefined
    : priceAlertAction;

  return (
    <section className={styles.detailPage}>
      <CatalogPageIntro
        breadcrumbs={{
          ariaLabel: 'Setcontext',
          className: styles.detailBreadcrumbs,
          items: [
            {
              href: themeDirectoryHref,
              id: 'theme-directory',
              label: "Thema's",
            },
            {
              href: themeHref,
              id: 'theme',
              label: (
                <CatalogCanonicalText>
                  {catalogSetDetail.theme}
                </CatalogCanonicalText>
              ),
            },
            { id: 'set-detail', label: visibleTitle },
          ],
        }}
        className={styles.detailPageIntro}
        contentClassName={styles.detailPageIntroContent}
      >
        <CatalogSetDetailHero
          badges={
            <>
              {themeHref ? (
                <ActionLink
                  className={styles.themeBadgeLink}
                  href={themeHref}
                  tone="inline"
                >
                  <span
                    className={styles.themeBadgeShell}
                    style={themeBadgeStyle}
                  >
                    <Badge className={styles.themeBadge} tone="neutral">
                      <CatalogCanonicalText>
                        {catalogSetDetail.theme}
                      </CatalogCanonicalText>
                    </Badge>
                  </span>
                </ActionLink>
              ) : (
                <span
                  className={styles.themeBadgeShell}
                  style={themeBadgeStyle}
                >
                  <Badge className={styles.themeBadge} tone="neutral">
                    <CatalogCanonicalText>
                      {catalogSetDetail.theme}
                    </CatalogCanonicalText>
                  </Badge>
                </span>
              )}
              {catalogSetDetail.subtheme ? (
                <Badge tone="neutral">
                  <CatalogCanonicalText>
                    {catalogSetDetail.subtheme}
                  </CatalogCanonicalText>
                </Badge>
              ) : null}
            </>
          }
          decisionPrimary={
            <CatalogPriceDecisionPrimary
              followAction={
                shouldLeadHeroWithFollowAction ? priceAlertAction : undefined
              }
              heroSideAction={heroCtaSideAction}
              primaryOffer={bestDeal}
            />
          }
          gallery={
            <CatalogSetImageGallery catalogSetDetail={catalogSetDetail} />
          }
          keyFacts={<CatalogKeyFacts items={heroSpecs} />}
          title={<CatalogCanonicalText>{visibleTitle}</CatalogCanonicalText>}
          titleSupplement={
            reviewSummary ? (
              <CatalogSetDetailHeroRating summary={reviewSummary} />
            ) : undefined
          }
        />
      </CatalogPageIntro>

      {offerList.length > 0 ||
      dealSupportItems.length > 0 ||
      priceHistoryPanel ||
      hasFollowModule ? (
        <section className={styles.detailCommerceFlow}>
          <CatalogOfferComparison
            className={styles.detailOfferComparisonSection}
            id={offerComparisonSectionId}
            offers={offerList}
            setDetailHref={setDetailHref ?? `/sets/${catalogSetDetail.slug}`}
            summaryLabel={offerSummaryLabel}
          />
          <CatalogSetSupportCard
            items={dealSupportItems}
            title={getCatalogDecisionSupportTitle(dealVerdict)}
          />
          {priceHistoryPanel}
          {hasFollowModule ? (
            <CatalogPriceDecisionSecondary
              compact
              followAction={secondaryPriceAlertAction}
              followCopy={followCopy}
              followTitle={followTitle}
              verdictTone={dealVerdict.tone}
            />
          ) : null}
        </section>
      ) : null}

      <div className={styles.detailSectionsList}>
        <CatalogSetProductDescription
          description={catalogSetDetail.legoProductDescription}
          imageAlt={`${visibleTitle} LEGO-set`}
          imageUrl={catalogSetDetail.primaryImage ?? catalogSetDetail.imageUrl}
        />

        {productReviewsSlot}
      </div>

      <CatalogSetProductFeatures
        features={catalogSetDetail.legoProductFeatures}
      />

      {similarSetsRail ? (
        <div className={styles.detailSimilarRail}>{similarSetsRail}</div>
      ) : null}

      <section className={styles.detailInfoGrid}>
        <CatalogSetOwnershipCard action={ownershipActions} />
        <CatalogSetSupportCard
          items={brickhuntValueItems}
          title="Zo lees je dit"
        />
        <CatalogTrustPanel trustSignals={trustSignals} />
      </section>

      {setNewsRail ? (
        <div className={styles.detailSimilarRail}>{setNewsRail}</div>
      ) : null}

      {recentlyViewedRail ? (
        <div className={styles.detailSimilarRail}>{recentlyViewedRail}</div>
      ) : null}
    </section>
  );
}

export function CatalogThemeHighlight({
  className,
  href,
  imageUrl,
  showFeatureSignature = true,
  themeSnapshot,
  trackingEvent,
  variant = 'default',
  visual,
}: {
  className?: string;
  href?: string;
  imageUrl?: string;
  showFeatureSignature?: boolean;
  themeSnapshot: CatalogThemeSnapshot;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  variant?: 'default' | 'feature' | 'portrait';
  visual?: CatalogThemeVisual;
}) {
  if (variant === 'portrait') {
    return (
      <CatalogVisualTile
        className={className}
        dataTheme={themeSnapshot.slug}
        href={href}
        imageAlt={`${themeSnapshot.signatureSet} LEGO-set`}
        imageUrl={visual?.imageUrl ?? imageUrl}
        meta={`${themeSnapshot.setCount} sets`}
        title={
          <CatalogCanonicalText>{themeSnapshot.name}</CatalogCanonicalText>
        }
        trackingEvent={trackingEvent}
        visual={visual}
      />
    );
  }

  if (variant === 'feature') {
    const featureVisualStyle = getCatalogThemeStyleVariables({
      visual,
    });
    const featureImageUrl = visual?.imageUrl ?? imageUrl;
    const featureContent = (
      <>
        {featureImageUrl ? (
          <div className={styles.themeFeatureVisual}>
            <img
              alt={`${themeSnapshot.signatureSet} LEGO-set`}
              className={styles.themeFeatureImage}
              decoding="async"
              height={420}
              loading="lazy"
              src={featureImageUrl}
              width={420}
            />
          </div>
        ) : null}
        <div className={styles.themeFeatureBody}>
          <div className={styles.themeFeatureTop}>
            <p className={styles.themeFeatureCount}>
              {themeSnapshot.setCount} gevolgde sets
            </p>
            <span className={styles.themeFeatureAction}>Bekijk sets</span>
          </div>
          <h3 className={styles.themeFeatureTitle}>
            <CatalogCanonicalText>{themeSnapshot.name}</CatalogCanonicalText>
          </h3>
          <p className={styles.themeFeatureCopy}>{themeSnapshot.momentum}</p>
          {showFeatureSignature ? (
            <p className={styles.themeFeatureSignature}>
              Pak eerst{' '}
              <CatalogCanonicalText>
                {themeSnapshot.signatureSet}
              </CatalogCanonicalText>
            </p>
          ) : null}
        </div>
      </>
    );

    return (
      <Surface
        as="article"
        className={`${styles.themeCard} ${styles.themeFeatureCard}${
          className ? ` ${className}` : ''
        }`}
        data-theme={themeSnapshot.slug}
        style={featureVisualStyle}
        tone="muted"
      >
        {href ? (
          <ActionLink
            className={styles.themeFeatureLink}
            href={href}
            tone="card"
            {...buildBrickhuntAnalyticsAttributes(trackingEvent)}
          >
            {featureContent}
          </ActionLink>
        ) : (
          featureContent
        )}
      </Surface>
    );
  }

  return (
    <Surface
      as="article"
      className={`${styles.themeCard}${className ? ` ${className}` : ''}`}
      tone="muted"
    >
      <div className={styles.themeHeader}>
        <Badge tone="accent">
          <CatalogCanonicalText>{themeSnapshot.name}</CatalogCanonicalText>
        </Badge>
        <h3 className={styles.cardTitle}>
          <CatalogCanonicalText>
            {themeSnapshot.signatureSet}
          </CatalogCanonicalText>
        </h3>
      </div>
      <p className={styles.mutedCopy}>{themeSnapshot.momentum}</p>
      <Badge tone="info">{themeSnapshot.setCount} gevolgde sets</Badge>
    </Surface>
  );
}

export function CatalogVisualTile({
  ariaCurrent,
  className,
  dataTile,
  dataTheme,
  href,
  imageAlt = '',
  imageUrl,
  meta,
  title,
  trackingEvent,
  visual,
}: {
  ariaCurrent?: HTMLAttributes<HTMLAnchorElement>['aria-current'];
  className?: string;
  dataTile?: string;
  dataTheme?: string;
  href?: string;
  imageAlt?: string;
  imageUrl?: string;
  meta?: ReactNode;
  title: ReactNode;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  visual?: CatalogThemeVisual;
}) {
  const visualStyle = getCatalogThemeStyleVariables({
    visual,
  });
  const tileImageUrl = imageUrl ?? visual?.imageUrl;
  const tileContent = (
    <>
      {tileImageUrl ? (
        <div className={styles.themePortraitVisual}>
          <img
            alt={imageAlt}
            className={styles.themePortraitImage}
            decoding="async"
            height={420}
            loading="lazy"
            src={tileImageUrl}
            width={420}
          />
        </div>
      ) : null}
      <div className={styles.themePortraitBody}>
        <h3 className={styles.themePortraitTitle}>{title}</h3>
        {meta ? <p className={styles.themePortraitMeta}>{meta}</p> : null}
      </div>
    </>
  );

  return (
    <Surface
      as="article"
      className={`${styles.themeCard} ${styles.themePortraitCard}${
        className ? ` ${className}` : ''
      }`}
      data-theme={dataTheme}
      data-visual-tile={dataTile}
      style={visualStyle}
      tone="muted"
    >
      {href ? (
        <ActionLink
          aria-current={ariaCurrent}
          className={styles.themePortraitLink}
          href={href}
          tone="card"
          {...buildBrickhuntAnalyticsAttributes(trackingEvent)}
        >
          {tileContent}
        </ActionLink>
      ) : (
        tileContent
      )}
    </Surface>
  );
}

export function CatalogUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Presentatieblokken voor setontdekking en detailverhalen."
        title="Retailwaardige catalogusoppervlakken met metadata voor verzamelaars."
      />
    </Surface>
  );
}

export default CatalogUi;
