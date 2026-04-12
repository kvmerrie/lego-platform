import {
  forwardRef,
  type CSSProperties,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import type {
  CatalogHomepageSetCard,
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import {
  buildCatalogThemeSlug,
  type CatalogSetImage,
  normalizeCatalogSetImages,
} from '@lego-platform/catalog/util';
import {
  ArrowDown,
  Blocks,
  Cake,
  CalendarDays,
  Clock3,
  Eye,
  Hash,
  Minus,
  Package2,
  Ruler,
  ShoppingBag,
  UsersRound,
} from 'lucide-react';
import {
  CatalogKeyFacts,
  CatalogOfferComparison,
  CatalogPriceDecisionPanel,
  CatalogTrustPanel,
  getCatalogDecisionSupportTitle,
  type CatalogKeyFact,
  type CatalogSetDetailBestDeal,
  type CatalogSetDetailOfferItem,
  type CatalogSetDetailSupportItem,
  type CatalogSetDetailTrustSignal,
  type CatalogSetDetailVerdict,
} from './catalog-commerce-ui';
import { CatalogSetDetailHero } from './catalog-composite-ui';
import {
  ActionLink,
  Badge,
  Breadcrumbs,
  LabelValue,
  LabelValueList,
  MarkerList,
  Panel,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import {
  buildBrickhuntAnalyticsAttributes,
  type BrickhuntAnalyticsEventDescriptor,
} from '@lego-platform/shared/util';
import {
  CatalogSetImageGalleryClient,
  type CatalogSetGalleryImageItem,
} from './catalog-set-image-gallery';
import styles from './catalog-ui.module.css';

export {
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
export type CatalogSetCardCtaMode = 'default' | 'commerce';

export const CatalogSetCardCollection = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {
    layout?: CatalogSetCardCollectionLayout;
    variant?: Extract<CatalogSetCardVariant, 'compact' | 'featured'>;
  }
>(function CatalogSetCardCollection(
  { children, className, layout = 'grid', variant = 'featured', ...rest },
  ref,
) {
  return (
    <div
      className={[
        styles.setCardCollection,
        layout === 'rail' ? styles.setCardCollectionRail : null,
        variant === 'compact'
          ? styles.setCardCollectionCompact
          : styles.setCardCollectionFeatured,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      ref={ref}
      {...rest}
    >
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

function CatalogSetVisual({
  altLabel,
  imageUrl,
  imageLoading,
  name,
  overlayBadges,
  setId,
  theme,
  variant,
}: {
  altLabel?: string;
  imageUrl?: string;
  imageLoading?: 'eager' | 'lazy';
  name: string;
  overlayBadges?: ReactNode;
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
      <div className={visualClassName}>
        {overlayBadges ? (
          <div className={styles.visualOverlay}>{overlayBadges}</div>
        ) : null}
        <div className={styles.visualMedia}>
          <img
            alt={altLabel ?? `${name} LEGO-set`}
            className={styles.setImage}
            decoding="async"
            loading={imageLoading ?? (variant === 'hero' ? 'eager' : 'lazy')}
            src={imageUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`${visualClassName} ${styles.visualFallback}`}>
      {overlayBadges ? (
        <div className={styles.visualOverlay}>{overlayBadges}</div>
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
  ctaMode,
  href,
  priceContext,
  trackingEvent,
  variant,
}: {
  ctaMode: CatalogSetCardCtaMode;
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  variant: CatalogSetCardVariant;
}): {
  className: string;
  href?: string;
  icon: typeof Eye | typeof ShoppingBag;
  label: string;
  rel?: string;
  target?: '_blank';
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
} {
  const primaryActionHref = priceContext?.primaryActionHref?.trim();

  if (ctaMode === 'commerce' && variant === 'featured' && primaryActionHref) {
    return {
      className: styles.cardCompactActionCommerce,
      href: primaryActionHref,
      icon: ShoppingBag,
      label: 'Koop nu',
      rel: 'noopener noreferrer',
      target: '_blank',
      trackingEvent: priceContext?.primaryActionTrackingEvent,
    };
  }

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
  return [
    {
      icon: CalendarDays,
      id: 'release-year',
      value: setSummary.releaseYear.toString(),
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

function formatMinifigureCount(minifigureCount?: number): string {
  if (typeof minifigureCount !== 'number') {
    return 'Nog niet bekend';
  }

  return minifigureCount.toLocaleString();
}

function formatCatalogSetStatus(
  setStatus: CatalogSetDetail['setStatus'],
): string | undefined {
  if (!setStatus) {
    return undefined;
  }

  if (setStatus === 'available') {
    return 'Nu beschikbaar';
  }

  if (setStatus === 'backorder') {
    return 'Nabestelling';
  }

  if (setStatus === 'retiring_soon') {
    return 'Gaat bijna uit assortiment';
  }

  return 'Uit assortiment';
}

function formatMinifigureHighlights(
  minifigureHighlights?: readonly string[],
): string | undefined {
  return minifigureHighlights?.length
    ? minifigureHighlights.join(', ')
    : undefined;
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
  setStatusLabel,
}: {
  catalogSetDetail: CatalogSetDetail;
  setStatusLabel?: string;
}): CatalogKeyFact[] {
  const heroFacts: CatalogKeyFact[] = [
    {
      id: 'set-number',
      icon: <Hash aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Setnummer',
      value: <CatalogCanonicalText>{catalogSetDetail.id}</CatalogCanonicalText>,
    },
  ];
  const recommendedAgeLabel = formatCatalogRecommendedAge(
    catalogSetDetail.recommendedAge,
  );

  if (recommendedAgeLabel) {
    heroFacts.push({
      id: 'recommended-age',
      icon: <Cake aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Leeftijd',
      value: recommendedAgeLabel,
    });
  }

  if (catalogSetDetail.displaySize?.value) {
    heroFacts.push({
      id: 'display-size',
      icon: <Ruler aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: catalogSetDetail.displaySize.label ?? 'Formaat',
      value: catalogSetDetail.displaySize.value,
    });
  }

  heroFacts.push({
    id: 'piece-count',
    icon: <Blocks aria-hidden="true" size={17} strokeWidth={2.2} />,
    label: 'Stenen',
    value: catalogSetDetail.pieces.toLocaleString('nl-NL'),
  });

  if (typeof catalogSetDetail.minifigureCount === 'number') {
    heroFacts.push({
      id: 'minifigures',
      icon: <UsersRound aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Minifiguren',
      value: formatMinifigureCount(catalogSetDetail.minifigureCount),
    });
  }

  if (heroFacts.length < 5) {
    heroFacts.push({
      id: 'release-year',
      icon: <CalendarDays aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Jaar',
      value: catalogSetDetail.releaseYear,
    });
  }

  if (heroFacts.length < 5 && setStatusLabel) {
    heroFacts.push({
      id: 'status',
      icon: <Package2 aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Status',
      value: setStatusLabel,
    });
  }

  return heroFacts;
}

export function CatalogSetCard({
  actions,
  ctaMode = 'default',
  contextBadge,
  href,
  priceContext,
  priceDisplay = 'default',
  savedState,
  setSummary,
  showThemeBadge = true,
  supportingNote,
  trackingEvent,
  variant = 'default',
}: {
  actions?: ReactNode;
  ctaMode?: CatalogSetCardCtaMode;
  contextBadge?: CatalogSetCardContextBadge;
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  priceDisplay?: CatalogSetCardPriceDisplay;
  savedState?: CatalogSetSavedState;
  setSummary: CatalogSetCardSummary;
  showThemeBadge?: boolean;
  supportingNote?: ReactNode;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  variant?: CatalogSetCardVariant;
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

  if (variant === 'compact') {
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
          imageUrl={setSummary.imageUrl}
          name={setSummary.name}
          overlayBadges={overlayBadges}
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
        </div>
      </>
    );

    return (
      <Surface
        as="article"
        className={`${styles.setCard} ${styles.setCardCompact}`}
        data-theme={setThemeSlug}
      >
        {href ? (
          <ActionLink
            className={styles.setCardLink}
            href={href}
            tone="card"
            {...buildBrickhuntAnalyticsAttributes(trackingEvent)}
          >
            {browseCardContent}
          </ActionLink>
        ) : (
          browseCardContent
        )}
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
          imageUrl={setSummary.imageUrl}
          name={setSummary.name}
          overlayBadges={overlayBadges}
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
        data-theme={setThemeSlug}
      >
        {href ? (
          <ActionLink
            className={styles.setCardLink}
            href={href}
            tone="card"
            {...buildBrickhuntAnalyticsAttributes(trackingEvent)}
          >
            {featuredCardContent}
          </ActionLink>
        ) : (
          <div className={styles.setCardLink}>{featuredCardContent}</div>
        )}
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
                  tone="inline"
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
    <Surface as="article" className={styles.setCard} data-theme={setThemeSlug}>
      <CatalogSetVisual
        imageUrl={setSummary.imageUrl}
        name={setSummary.name}
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
            {setSummary.releaseYear} ·{' '}
            {setSummary.pieces.toLocaleString('nl-NL')} stenen
          </p>
        </div>
        <h3 className={`${styles.cardTitle} ${styles.cardTitleClamp}`}>
          <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
        </h3>
        <p className={`${styles.cardTagline} ${styles.cardTaglineClamp}`}>
          {setSummary.tagline ?? setSummary.collectorAngle}
        </p>
      </div>
      {priceContext && priceDisplay === 'default' ? (
        <div className={styles.priceBlock}>
          <p className={styles.priceLabel}>Reviewed prijs</p>
          <p className={styles.priceValue}>{priceContext.currentPrice}</p>
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
        <CatalogSupportingDetail
          label="Waarom verzamelaars dit kiezen"
          value={setSummary.collectorAngle}
        />
        {setSummary.availability ? (
          <CatalogSupportingDetail
            label="Beschikbaarheid"
            value={setSummary.availability}
          />
        ) : null}
      </div>
      <CatalogSetMetadata
        items={[
          { label: 'Steentjes', value: setSummary.pieces.toLocaleString() },
          { label: 'Jaar', value: setSummary.releaseYear },
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
): readonly CatalogSetGalleryImageItem[] {
  return getCatalogGalleryImages(catalogSetDetail).map(
    (catalogSetImage, index) => ({
      altLabel:
        index === 0
          ? `${catalogSetDetail.name} LEGO-set`
          : `${catalogSetDetail.name} LEGO-set afbeelding ${index + 1}`,
      url: catalogSetImage.url,
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
    <CatalogSetImageGalleryClient
      galleryImages={galleryImages}
      name={catalogSetDetail.name}
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
  themeDirectoryHref?: string;
  themeHref?: string;
  trustSignals?: readonly CatalogSetDetailTrustSignal[];
}) {
  const setStatusLabel = formatCatalogSetStatus(catalogSetDetail.setStatus);
  const minifigureHighlightsLabel = formatMinifigureHighlights(
    catalogSetDetail.minifigureHighlights,
  );
  const setHighlights =
    catalogSetDetail.collectorHighlights.length > 0
      ? catalogSetDetail.collectorHighlights.slice(0, 3)
      : [catalogSetDetail.collectorAngle];
  const heroSpecs = buildCatalogSetDetailHeroFacts({
    catalogSetDetail,
    setStatusLabel,
  });

  return (
    <section className={styles.detailPage}>
      <Breadcrumbs
        ariaLabel="Setcontext"
        className={styles.detailBreadcrumbs}
        items={[
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
        ]}
      />
      <CatalogSetDetailHero
        badges={
          <>
            {themeHref ? (
              <ActionLink
                className={styles.themeBadgeLink}
                href={themeHref}
                tone="inline"
              >
                <Badge tone="accent">
                  <CatalogCanonicalText>
                    {catalogSetDetail.theme}
                  </CatalogCanonicalText>
                </Badge>
              </ActionLink>
            ) : (
              <Badge tone="accent">
                <CatalogCanonicalText>
                  {catalogSetDetail.theme}
                </CatalogCanonicalText>
              </Badge>
            )}
            {catalogSetDetail.subtheme ? (
              <Badge tone="neutral">
                <CatalogCanonicalText>
                  {catalogSetDetail.subtheme}
                </CatalogCanonicalText>
              </Badge>
            ) : null}
            <Badge tone={dealVerdict.tone ?? 'neutral'}>
              {dealVerdict.label}
            </Badge>
          </>
        }
        decisionPanel={
          <CatalogPriceDecisionPanel
            followAction={priceAlertAction}
            followCopy={followCopy}
            followEyebrow={followEyebrow}
            followTitle={followTitle}
            leadWithFollow={dealVerdict.tone === 'warning'}
            primaryOffer={bestDeal}
            supportItems={dealSupportItems}
            supportTitle={getCatalogDecisionSupportTitle(dealVerdict)}
            verdictTone={dealVerdict.tone}
          />
        }
        gallery={<CatalogSetImageGallery catalogSetDetail={catalogSetDetail} />}
        keyFacts={<CatalogKeyFacts items={heroSpecs} />}
        pitch={`Waarom veel verzamelaars deze willen: ${catalogSetDetail.tagline}`}
        title={
          <CatalogCanonicalText>{catalogSetDetail.name}</CatalogCanonicalText>
        }
        verdict={dealVerdict}
      />

      <CatalogOfferComparison
        offers={offerList}
        summaryLabel={offerSummaryLabel}
      />

      {priceHistoryPanel ? (
        <section className={styles.detailPricingStack}>
          {priceHistoryPanel}
        </section>
      ) : null}

      <section className={styles.detailInfoGrid}>
        <Panel
          as="aside"
          className={styles.notesPanel}
          description={catalogSetDetail.collectorAngle}
          eyebrow="Waarom deze set"
          elevation="rested"
          title="Wat hier blijft hangen"
          titleAs="h2"
          tone="muted"
        >
          {minifigureHighlightsLabel ? (
            <CatalogSupportingDetail
              label="Minifigs"
              value={
                <CatalogCanonicalText>
                  {minifigureHighlightsLabel}
                </CatalogCanonicalText>
              }
            />
          ) : null}
          <MarkerList
            className={styles.highlightsList}
            items={setHighlights.map((collectorHighlight) => ({
              content: collectorHighlight,
              id: collectorHighlight,
            }))}
          />
        </Panel>
        <CatalogSetOwnershipCard action={ownershipActions} />
      </section>
      <CatalogSetSupportCard
        eyebrow="Brickhunt kijkt mee"
        items={brickhuntValueItems}
        title="Waarom dit hier meer is dan een prijslink"
      />
      <CatalogTrustPanel trustSignals={trustSignals} />
    </section>
  );
}

export function CatalogThemeHighlight({
  className,
  href,
  imageUrl,
  themeSnapshot,
  trackingEvent,
  variant = 'default',
  visual,
}: {
  className?: string;
  href?: string;
  imageUrl?: string;
  themeSnapshot: CatalogThemeSnapshot;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  variant?: 'default' | 'feature' | 'portrait';
  visual?: CatalogThemeVisual;
}) {
  function getThemeMutedColor(textColor: string): string {
    const normalizedTextColor = textColor.trim().toLowerCase();

    if (
      normalizedTextColor === '#fff' ||
      normalizedTextColor === '#ffffff' ||
      normalizedTextColor === 'white' ||
      normalizedTextColor === 'rgb(255, 255, 255)' ||
      normalizedTextColor === 'rgb(255,255,255)'
    ) {
      return '#f4f7fb';
    }

    return '#425066';
  }

  if (variant === 'portrait') {
    const portraitVisualStyle = {
      ...(visual?.backgroundColor
        ? ({
            '--theme-surface': visual.backgroundColor,
          } as CSSProperties)
        : {}),
      ...(visual?.textColor
        ? ({
            '--theme-text': visual.textColor,
            '--theme-muted': getThemeMutedColor(visual.textColor),
          } as CSSProperties)
        : {}),
    };
    const portraitImageUrl = visual?.imageUrl ?? imageUrl;
    const portraitContent = (
      <>
        {portraitImageUrl ? (
          <div className={styles.themePortraitVisual}>
            <img
              alt={`${themeSnapshot.signatureSet} LEGO-set`}
              className={styles.themePortraitImage}
              decoding="async"
              loading="lazy"
              src={portraitImageUrl}
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
        style={
          Object.keys(portraitVisualStyle).length > 0
            ? portraitVisualStyle
            : undefined
        }
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
    const featureVisualStyle = {
      ...(visual?.backgroundColor
        ? ({
            '--theme-surface': visual.backgroundColor,
          } as CSSProperties)
        : {}),
      ...(visual?.textColor
        ? ({
            '--theme-text': visual.textColor,
            '--theme-muted': getThemeMutedColor(visual.textColor),
          } as CSSProperties)
        : {}),
    };
    const featureImageUrl = visual?.imageUrl ?? imageUrl;
    const featureContent = (
      <>
        {featureImageUrl ? (
          <div className={styles.themeFeatureVisual}>
            <img
              alt={`${themeSnapshot.signatureSet} LEGO-set`}
              className={styles.themeFeatureImage}
              decoding="async"
              loading="lazy"
              src={featureImageUrl}
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
          <p className={styles.themeFeatureSignature}>
            Pak eerst{' '}
            <CatalogCanonicalText>
              {themeSnapshot.signatureSet}
            </CatalogCanonicalText>
          </p>
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
        style={
          Object.keys(featureVisualStyle).length > 0
            ? featureVisualStyle
            : undefined
        }
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
