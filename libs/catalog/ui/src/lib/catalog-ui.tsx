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
  CatalogPublicThemeReference,
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import {
  buildCatalogReleaseLabel,
  buildCatalogThemeSlug,
  getCatalogThemeMutedTextColor,
  type CatalogSetImage,
  normalizeCatalogSetImages,
} from '@lego-platform/catalog/util';
import {
  ArrowDown,
  Blocks,
  CalendarDays,
  ChevronRight,
  Clock3,
  Eye,
  Hash,
  Minus,
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
import styles from './catalog-ui.module.css';

export {
  CatalogPageIntro,
  CatalogQuickFilterBar,
  CatalogSectionHeader,
  CatalogSectionShell,
  CatalogSetDetailHero,
  CatalogSplitIntroPanel,
  type CatalogIntroPanelSection,
} from './catalog-composite-ui';

type CatalogSetCardSummary = CatalogSetSummary &
  Partial<Pick<CatalogHomepageSetCard, 'availability' | 'tagline'>>;

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

function getPricePositionClassName(
  pricePositionTone?: CatalogSetCardPriceContextTone,
): string {
  if (pricePositionTone === 'positive') {
    return styles.cardCompactSignalPositive;
  }

  if (pricePositionTone === 'warning') {
    return styles.cardCompactSignalWarning;
  }

  return styles.cardCompactSignalInfo;
}

function getCardPriceSignalIcon(
  pricePositionTone?: CatalogSetCardPriceContextTone,
): typeof ArrowDown {
  if (pricePositionTone === 'warning') {
    return Clock3;
  }

  if (pricePositionTone === 'positive') {
    return ArrowDown;
  }

  return Minus;
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

function getCardPrimaryActionConfig({
  href,
  trackingEvent,
}: {
  ctaMode: CatalogSetCardCtaMode;
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  variant: CatalogSetCardVariant;
}): {
  className: string;
  href?: string;
  icon: typeof Eye;
  label: string;
  rel?: string;
  target?: '_blank';
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
} {
  return {
    className: styles.cardCompactActionBrowse,
    href,
    icon: Eye,
    label: 'Bekijk set',
    trackingEvent,
  };
}

function formatCardSetFacts(setSummary: CatalogSetCardSummary): Array<{
  icon: typeof CalendarDays;
  id: string;
  value: string;
}> {
  const releaseFactLabel =
    buildCatalogReleaseLabel({
      releaseDate: setSummary.releaseDate,
      releaseDatePrecision: setSummary.releaseDatePrecision,
      releaseYear: setSummary.releaseYear,
      variant: 'compact',
    })?.value ?? setSummary.releaseYear.toString();

  return [
    {
      icon: CalendarDays,
      id: 'release',
      value: releaseFactLabel,
    },
    {
      icon: Blocks,
      id: 'piece-count',
      value: `${setSummary.pieces.toLocaleString('nl-NL')} stenen`,
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
            <FactIcon
              aria-hidden="true"
              className={styles.cardFactIcon}
              strokeWidth={2.1}
            />
            <span>{factItem.value}</span>
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

function CatalogSetNumberMeta({ setId }: { setId: string }) {
  return (
    <p className={styles.cardCompactMeta}>
      <Hash
        aria-hidden="true"
        className={styles.cardCompactMetaIcon}
        strokeWidth={2.1}
      />
      <CatalogCanonicalText>{setId}</CatalogCanonicalText>
    </p>
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

  return {
    ...(resolvedVisual.backgroundColor
      ? ({
          '--catalog-theme-badge-surface': resolvedVisual.backgroundColor,
          '--card-theme-badge-bg': resolvedVisual.backgroundColor,
          '--theme-surface': resolvedVisual.backgroundColor,
        } as CSSProperties)
      : {}),
    ...(resolvedVisual.textColor
      ? ({
          '--catalog-theme-badge-text': resolvedVisual.textColor,
          '--card-theme-badge-text': resolvedVisual.textColor,
          '--theme-text': resolvedVisual.textColor,
          '--theme-muted': getCatalogThemeMutedTextColor(
            resolvedVisual.textColor,
          ),
        } as CSSProperties)
      : {}),
  };
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
          imageUrl={setSummary.imageUrl}
          name={setSummary.name}
          overlayBadges={overlayBadges}
          overlayControls={visualActions}
          setId={setSummary.id}
          theme={setSummary.theme}
          variant="card"
        />
        <div className={styles.cardCompactBody}>
          <h3 className={`${styles.cardTitle} ${styles.cardTitleClamp}`}>
            <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
          </h3>
          <CatalogSetFactRow
            className={styles.cardCompactSupportingSlot}
            setSummary={setSummary}
          />
          {!compactUsesDecisionZone ? (
            <div className={styles.cardCompactFooter}>
              <CatalogSetNumberMeta setId={setSummary.id} />
              {href ? (
                <span
                  className={`${styles.cardCompactAction} ${styles.cardCompactPrimaryAction} ${primaryAction.className}`}
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
            <CatalogSetNumberMeta setId={setSummary.id} />
            <div className={styles.cardCompactFooterActions}>
              {actions ? (
                <div className={styles.cardCompactSecondaryAction}>
                  {actions}
                </div>
              ) : null}
              {primaryAction.href ? (
                <ActionLink
                  aria-label={primaryAction.label}
                  className={`${styles.cardCompactAction} ${styles.cardCompactPrimaryAction} ${primaryAction.className}`}
                  href={primaryAction.href}
                  rel={primaryAction.rel}
                  target={primaryAction.target}
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
    const featuredDecisionLabel =
      priceContext?.decisionLabel ?? priceContext?.pricePositionLabel;
    const featuredFooterMeta = priceContext ? null : setSummary.id;
    const FeaturedPriceSignalIcon =
      featuredDecisionLabel &&
      getCardPriceSignalIcon(priceContext?.pricePositionTone);
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
          imageUrl={setSummary.imageUrl}
          name={setSummary.name}
          overlayBadges={overlayBadges}
          overlayControls={visualActions}
          setId={setSummary.id}
          theme={setSummary.theme}
          variant="card"
        />
        <div className={`${styles.cardCompactBody} ${styles.featuredCardBody}`}>
          <h3 className={`${styles.cardTitle} ${styles.cardTitleClamp}`}>
            <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
          </h3>
          <CatalogSetFactRow
            className={styles.cardFeaturedSupportingSlot}
            setSummary={setSummary}
          />
          <div className={styles.priceCompactBlock}>
            {priceContext ? (
              <>
                {featuredDecisionLabel ? (
                  <p
                    className={`${styles.cardCompactSignal} ${getPricePositionClassName(
                      priceContext.pricePositionTone,
                    )}`}
                  >
                    {FeaturedPriceSignalIcon ? (
                      <FeaturedPriceSignalIcon
                        aria-hidden="true"
                        className={styles.cardCompactSignalIcon}
                      />
                    ) : null}
                    {featuredDecisionLabel}
                  </p>
                ) : null}
                <p className={styles.priceValue}>{priceContext.currentPrice}</p>
                {priceContext.discountMetric ? (
                  <p
                    className={styles.discountMetric}
                    data-catalog-discount-metric="true"
                  >
                    {priceContext.discountMetric}
                  </p>
                ) : null}
                {priceContext.dealReason ? (
                  <p className={styles.dealReason}>{priceContext.dealReason}</p>
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
        {featuredFooterMeta || primaryAction.href || actions ? (
          <div className={styles.cardCompactDecisionZone}>
            {featuredFooterMeta ? (
              <CatalogSetNumberMeta setId={featuredFooterMeta} />
            ) : (
              <span className={styles.cardCompactDecisionSpacer} />
            )}
            <div className={styles.cardCompactFooterActions}>
              {actions ? (
                <div className={styles.cardCompactSecondaryAction}>
                  {actions}
                </div>
              ) : null}
              {primaryAction.href ? (
                <ActionLink
                  aria-label={primaryAction.label}
                  className={`${styles.cardCompactAction} ${styles.cardCompactPrimaryAction} ${primaryAction.className}`}
                  href={primaryAction.href}
                  rel={primaryAction.rel}
                  target={primaryAction.target}
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
        imageUrl={setSummary.imageUrl}
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
          {priceContext.dealReason ? (
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
      {actions ? <div className={styles.cardActions}>{actions}</div> : null}
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
    }).images ?? []
  );
}

function createCatalogGalleryImageItems(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'id' | 'imageUrl' | 'images' | 'name' | 'primaryImage'
  >,
): readonly CarouselImage[] {
  return getCatalogGalleryImages(catalogSetDetail).map(
    (catalogSetImage, index) => ({
      alt:
        index === 0
          ? `${catalogSetDetail.name} LEGO-set`
          : `${catalogSetDetail.name} LEGO-set afbeelding ${index + 1}`,
      src: catalogSetImage.url,
    }),
  );
}

function CatalogSetImageGallery({
  catalogSetDetail,
}: {
  catalogSetDetail: CatalogSetDetail;
}) {
  const galleryImages = createCatalogGalleryImageItems(catalogSetDetail);

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
    <ImageGallery
      ariaLabel={`Afbeeldingen van ${catalogSetDetail.name}`}
      detailMobileFullBleed
      images={galleryImages}
      variant="detail"
    />
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
      eyebrow="Je collectie"
      elevation="rested"
      title="Al in huis?"
      tone="muted"
    >
      <div className={styles.ownershipAction}>{action}</div>
    </Panel>
  );
}

function CatalogSetSupportCard({
  eyebrow,
  items,
  title,
}: {
  eyebrow: string;
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
      eyebrow={eyebrow}
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

export function CatalogSetDetailPanel({
  bestDeal,
  brickhuntValueItems = [],
  catalogSetDetail,
  dealSupportItems = [],
  dealVerdict,
  followCopy,
  followEyebrow,
  followTitle,
  offerList = [],
  offerSummaryLabel,
  ownershipActions,
  priceAlertAction,
  priceHistoryPanel,
  recentlyViewedRail,
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
  offerList?: readonly CatalogSetDetailOfferItem[];
  offerSummaryLabel?: string;
  ownershipActions?: ReactNode;
  priceAlertAction?: ReactNode;
  priceHistoryPanel?: ReactNode;
  recentlyViewedRail?: ReactNode;
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
  const offerComparisonSectionId = 'set-offers';
  const themeBadgeStyle = getCatalogThemeStyleVariables({
    visual: getCatalogPublicThemeVisual(catalogSetDetail.publicTheme),
  });
  const hasFollowModule = Boolean(
    priceAlertAction || followCopy || followTitle || followEyebrow,
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
            { id: 'set-detail', label: 'Setdetail' },
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
              primaryOffer={bestDeal}
            />
          }
          eyebrow={
            <span className={styles.detailHeroIdentifier}>
              <Hash
                aria-hidden="true"
                className={styles.detailHeroIdentifierIcon}
                size={14}
                strokeWidth={2.2}
              />
              <CatalogCanonicalText>{catalogSetDetail.id}</CatalogCanonicalText>
            </span>
          }
          gallery={
            <CatalogSetImageGallery catalogSetDetail={catalogSetDetail} />
          }
          keyFacts={<CatalogKeyFacts items={heroSpecs} />}
          title={
            <CatalogCanonicalText>{catalogSetDetail.name}</CatalogCanonicalText>
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
            eyebrow="Koopsignaal"
            items={dealSupportItems}
            title={getCatalogDecisionSupportTitle(dealVerdict)}
          />
          {priceHistoryPanel}
          {hasFollowModule ? (
            <CatalogPriceDecisionSecondary
              compact
              followAction={secondaryPriceAlertAction}
              followCopy={followCopy}
              followEyebrow={followEyebrow}
              followTitle={followTitle}
              verdictTone={dealVerdict.tone}
            />
          ) : null}
        </section>
      ) : null}

      {similarSetsRail ? (
        <div className={styles.detailSimilarRail}>{similarSetsRail}</div>
      ) : null}

      <section className={styles.detailInfoGrid}>
        <CatalogSetOwnershipCard action={ownershipActions} />
        <CatalogSetSupportCard
          eyebrow="Brickhunt checkt"
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
    const portraitVisualStyle = getCatalogThemeStyleVariables({
      visual,
    });
    const portraitImageUrl = visual?.imageUrl ?? imageUrl;
    const portraitContent = (
      <>
        {portraitImageUrl ? (
          <div className={styles.themePortraitVisual}>
            <img
              alt={`${themeSnapshot.signatureSet} LEGO-set`}
              className={styles.themePortraitImage}
              decoding="async"
              height={420}
              loading="lazy"
              src={portraitImageUrl}
              width={420}
            />
          </div>
        ) : null}
        <div className={styles.themePortraitBody}>
          <h3 className={styles.themePortraitTitle}>
            <CatalogCanonicalText>{themeSnapshot.name}</CatalogCanonicalText>
          </h3>
          <p className={styles.themePortraitMeta}>
            {themeSnapshot.setCount} sets
          </p>
        </div>
      </>
    );

    return (
      <Surface
        as="article"
        className={`${styles.themeCard} ${styles.themePortraitCard}${
          className ? ` ${className}` : ''
        }`}
        data-theme={themeSnapshot.slug}
        style={portraitVisualStyle}
        tone="muted"
      >
        {href ? (
          <ActionLink
            className={styles.themePortraitLink}
            href={href}
            tone="card"
            {...buildBrickhuntAnalyticsAttributes(trackingEvent)}
          >
            {portraitContent}
          </ActionLink>
        ) : (
          portraitContent
        )}
      </Surface>
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

export function CatalogUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Presentatieblokken voor setontdekking en detailverhalen."
        eyebrow="Catalogus-UI"
        title="Retailwaardige catalogusoppervlakken met metadata voor verzamelaars."
      />
    </Surface>
  );
}

export default CatalogUi;
