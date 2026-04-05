import type { CSSProperties, ComponentProps, ReactNode } from 'react';
import type {
  CatalogHomepageSetCard,
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import {
  ActionLink,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import styles from './catalog-ui.module.css';

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

export interface CatalogIntroPanelSection {
  description?: string;
  eyebrow?: string;
  meta?: string;
  title: string;
  titleAs?: 'h1' | 'h2' | 'h3';
  tone?: 'default' | 'display';
}

export interface CatalogSetCardPriceContext {
  coverageLabel: string;
  currentPrice: string;
  merchantLabel: string;
  pricePositionLabel?: string;
  pricePositionTone?: CatalogSetCardPriceContextTone;
  reviewedLabel: string;
}

export interface CatalogSetCardContextBadge {
  label: string;
  tone?: CatalogSetCardBadgeTone;
}

export interface CatalogSetDetailVerdict {
  explanation: string;
  label: string;
  tone?: ComponentProps<typeof Badge>['tone'];
}

export interface CatalogSetDetailBestDeal {
  checkedLabel: string;
  ctaHref?: string;
  ctaLabel?: string;
  merchantLabel: string;
  price: string;
  stockLabel: string;
}

export interface CatalogSetDetailOfferItem {
  checkedLabel: string;
  ctaHref: string;
  ctaLabel: string;
  isBest?: boolean;
  merchantLabel: string;
  price: string;
  stockLabel: string;
}

export interface CatalogSetDetailTrustSignal {
  label: string;
  value: string;
}

type CatalogSetCardVariant = 'compact' | 'default' | 'featured';
type CatalogSetSavedState = 'owned' | 'wishlist';
type CatalogSetCardPriceDisplay = 'default' | 'subtle';

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
  setId,
  theme,
  variant,
}: {
  altLabel?: string;
  imageUrl?: string;
  imageLoading?: 'eager' | 'lazy';
  name: string;
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
      <Badge tone="accent">
        <CatalogCanonicalText>{theme}</CatalogCanonicalText>
      </Badge>
      <p className={styles.visualFallbackTitle}>
        Officiele afbeelding nog niet gepubliceerd
      </p>
      <p className={styles.visualFallbackMeta}>Set {setId}</p>
    </div>
  );
}

function CatalogSupportingDetail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={styles.supportingDetail}>
      <p className={styles.supportingLabel}>{label}</p>
      <p className={styles.supportingValue}>{value}</p>
    </div>
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
    <dl
      className={
        className ? `${styles.metaGrid} ${className}` : styles.metaGrid
      }
    >
      {items.map((item) => (
        <div className={styles.metaItem} key={item.label}>
          <dt className={styles.metaLabel}>{item.label}</dt>
          <dd className={styles.metaValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatMinifigureCount(minifigureCount?: number): string {
  if (typeof minifigureCount !== 'number') {
    return 'Nog niet lokaal bijgehouden';
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

export function CatalogSetCard({
  actions,
  contextBadge,
  href,
  priceContext,
  priceDisplay = 'default',
  savedState,
  setSummary,
  supportingNote,
  variant = 'default',
}: {
  actions?: ReactNode;
  contextBadge?: CatalogSetCardContextBadge;
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  priceDisplay?: CatalogSetCardPriceDisplay;
  savedState?: CatalogSetSavedState;
  setSummary: CatalogSetCardSummary;
  supportingNote?: ReactNode;
  variant?: CatalogSetCardVariant;
}) {
  if (variant === 'compact') {
    const browseCardContent = (
      <>
        <CatalogSetVisual
          imageUrl={setSummary.imageUrl}
          name={setSummary.name}
          setId={setSummary.id}
          theme={setSummary.theme}
          variant="card"
        />
        <div className={styles.cardCompactBody}>
          <div className={styles.cardCompactBadgeRow}>
            <Badge tone="accent">
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
          </div>
          <h3 className={styles.cardTitle}>
            <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
          </h3>
          <p className={styles.cardBrowseSupporting}>
            {supportingNote ?? setSummary.tagline ?? setSummary.collectorAngle}
          </p>
          <div className={styles.cardCompactFooter}>
            <p className={styles.cardCompactMeta}>
              {setSummary.releaseYear} · {setSummary.priceRange}
            </p>
            {href ? (
              <span className={styles.cardCompactAction}>Bekijk set</span>
            ) : null}
          </div>
        </div>
      </>
    );

    return (
      <Surface
        as="article"
        className={`${styles.setCard} ${styles.setCardCompact}`}
      >
        {href ? (
          <ActionLink className={styles.setCardLink} href={href} tone="card">
            {browseCardContent}
          </ActionLink>
        ) : (
          browseCardContent
        )}
      </Surface>
    );
  }

  if (variant === 'featured') {
    const featuredCardContent = (
      <>
        <CatalogSetVisual
          imageUrl={setSummary.imageUrl}
          name={setSummary.name}
          setId={setSummary.id}
          theme={setSummary.theme}
          variant="card"
        />
        <div className={styles.cardCompactBody}>
          <div className={styles.cardCompactBadgeRow}>
            <Badge tone="accent">
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
          </div>
          <h3 className={styles.cardTitle}>
            <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
          </h3>
          <div className={styles.priceCompactBlock}>
            <p className={styles.priceLabel}>Reviewed prijs</p>
            {priceContext ? (
              <>
                <p className={styles.priceValue}>{priceContext.currentPrice}</p>
                <p className={styles.cardCompactSupporting}>
                  {priceContext.merchantLabel}
                </p>
                {priceContext.pricePositionLabel ? (
                  <p className={styles.cardCompactSignal}>
                    {priceContext.pricePositionLabel}
                  </p>
                ) : null}
                {supportingNote ? (
                  <p className={styles.cardCompactSupporting}>
                    {supportingNote}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className={styles.priceUnavailableValue}>
                  Reviewed prijs nog niet gepubliceerd
                </p>
                <p className={styles.cardCompactSupporting}>
                  {supportingNote ?? 'Setpagina staat live.'}
                </p>
              </>
            )}
          </div>
          <div className={styles.cardCompactFooter}>
            <p className={styles.cardCompactMeta}>
              {priceContext ? priceContext.reviewedLabel : 'Setpagina live'}
            </p>
            {href ? (
              <span className={styles.cardCompactAction}>Bekijk set</span>
            ) : null}
          </div>
        </div>
      </>
    );

    return (
      <Surface
        as="article"
        className={`${styles.setCard} ${styles.setCardCompact}`}
      >
        {href ? (
          <ActionLink className={styles.setCardLink} href={href} tone="card">
            {featuredCardContent}
          </ActionLink>
        ) : (
          featuredCardContent
        )}
      </Surface>
    );
  }

  return (
    <Surface as="article" className={styles.setCard}>
      <CatalogSetVisual
        imageUrl={setSummary.imageUrl}
        name={setSummary.name}
        setId={setSummary.id}
        theme={setSummary.theme}
        variant="card"
      />
      <div className={styles.cardHeader}>
        <div className={styles.cardMetaRow}>
          <Badge tone="accent">
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
            {setSummary.releaseYear} · {setSummary.priceRange}
          </p>
        </div>
        <h3 className={styles.cardTitle}>
          <CatalogCanonicalText>{setSummary.name}</CatalogCanonicalText>
        </h3>
        <p className={styles.cardTagline}>
          {setSummary.tagline ?? setSummary.collectorAngle}
        </p>
      </div>
      {priceContext && priceDisplay === 'default' ? (
        <div className={styles.priceBlock}>
          <p className={styles.priceLabel}>Reviewed prijs</p>
          <p className={styles.priceValue}>{priceContext.currentPrice}</p>
          <p className={styles.priceMeta}>{priceContext.merchantLabel}</p>
          {priceContext.pricePositionLabel ? (
            <p className={styles.pricePosition}>
              {priceContext.pricePositionLabel}
            </p>
          ) : null}
          <div className={styles.supportingGrid}>
            <CatalogSupportingDetail
              label="Dekking"
              value={priceContext.coverageLabel}
            />
            <CatalogSupportingDetail
              label="Actualiteit"
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
            value={`${priceContext.currentPrice} · ${priceContext.merchantLabel}`}
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
          { label: 'Prijsklasse', value: setSummary.priceRange },
        ]}
      />
      {actions ? <div className={styles.cardActions}>{actions}</div> : null}
      {href ? (
        <ActionLink className={styles.actionLink} href={href} tone="secondary">
          Bekijk set
        </ActionLink>
      ) : null}
    </Surface>
  );
}

export function CatalogQuickFilterBar({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: readonly {
    href: string;
    isActive?: boolean;
    label: string;
  }[];
}) {
  return (
    <nav aria-label={ariaLabel} className={styles.quickFilterNav}>
      <ul className={styles.quickFilterList}>
        {items.map((item) => (
          <li className={styles.quickFilterItem} key={item.label}>
            <ActionLink
              aria-current={item.isActive ? 'page' : undefined}
              className={styles.quickFilterChip}
              href={item.href}
              tone={item.isActive ? 'accent' : 'secondary'}
            >
              {item.label}
            </ActionLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function CatalogSplitIntroPanel({
  actionHref,
  actionLabel,
  actionTone = 'accent',
  className,
  primary,
  secondary,
}: {
  actionHref?: string;
  actionLabel?: string;
  actionTone?: ComponentProps<typeof ActionLink>['tone'];
  className?: string;
  primary: CatalogIntroPanelSection;
  secondary: CatalogIntroPanelSection;
}) {
  return (
    <Surface
      as="section"
      className={
        className ? `${styles.heroPanel} ${className}` : styles.heroPanel
      }
      elevation="floating"
      tone="default"
    >
      <div className={styles.heroPrimary}>
        <SectionHeading
          description={primary.description}
          eyebrow={primary.eyebrow}
          title={primary.title}
          titleAs={primary.titleAs}
          tone={primary.tone}
        />
        {primary.meta ? (
          <p className={styles.heroMeta}>{primary.meta}</p>
        ) : null}
      </div>
      <div className={styles.heroSecondary}>
        <SectionHeading
          description={secondary.description}
          eyebrow={secondary.eyebrow}
          title={secondary.title}
          titleAs={secondary.titleAs}
          tone={secondary.tone}
        />
        {actionHref && actionLabel ? (
          <ActionLink
            className={styles.actionLink}
            href={actionHref}
            tone={actionTone}
          >
            {actionLabel}
          </ActionLink>
        ) : null}
      </div>
    </Surface>
  );
}

function getCatalogGalleryImages(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'imageUrl' | 'images' | 'primaryImage'
  >,
): string[] {
  return [
    catalogSetDetail.primaryImage,
    ...(catalogSetDetail.images ?? []),
    catalogSetDetail.imageUrl,
  ].filter((imageUrl, index, imageUrls): imageUrl is string => {
    return Boolean(imageUrl) && imageUrls.indexOf(imageUrl) === index;
  });
}

function CatalogSetImageGallery({
  catalogSetDetail,
}: {
  catalogSetDetail: CatalogSetDetail;
}) {
  const galleryImages = getCatalogGalleryImages(catalogSetDetail);
  const galleryId = `set-gallery-${catalogSetDetail.id}`;

  if (galleryImages.length <= 1) {
    return (
      <CatalogSetVisual
        imageUrl={galleryImages[0]}
        name={catalogSetDetail.name}
        setId={catalogSetDetail.id}
        theme={catalogSetDetail.theme}
        variant="hero"
      />
    );
  }

  return (
    <div className={styles.galleryShell}>
      <div
        aria-label={`${catalogSetDetail.name} fotogalerij`}
        className={styles.galleryTrack}
        role="group"
      >
        {galleryImages.map((galleryImageUrl, index) => (
          <div
            className={styles.gallerySlide}
            id={`${galleryId}-${index + 1}`}
            key={galleryImageUrl}
          >
            <CatalogSetVisual
              altLabel={
                index === 0
                  ? `${catalogSetDetail.name} LEGO-set`
                  : `${catalogSetDetail.name} LEGO-set afbeelding ${index + 1}`
              }
              imageLoading={index === 0 ? 'eager' : 'lazy'}
              imageUrl={galleryImageUrl}
              name={catalogSetDetail.name}
              setId={catalogSetDetail.id}
              theme={catalogSetDetail.theme}
              variant="hero"
            />
          </div>
        ))}
      </div>
      <div
        aria-label="Galerijnavigatie"
        className={styles.galleryDots}
        role="navigation"
      >
        {galleryImages.map((_, index) => (
          <a
            aria-label={`Ga naar afbeelding ${index + 1}`}
            className={styles.galleryDot}
            href={`#${galleryId}-${index + 1}`}
            key={`${galleryId}-dot-${index + 1}`}
          />
        ))}
      </div>
      <p className={styles.galleryMeta}>Swipe voor meer foto's</p>
    </div>
  );
}

function CatalogSetBestDealCard({
  bestDeal,
}: {
  bestDeal?: CatalogSetDetailBestDeal;
}) {
  if (!bestDeal) {
    return (
      <Surface
        as="section"
        className={styles.bestDealCard}
        elevation="floating"
        tone="accent"
      >
        <p className={styles.bestDealEyebrow}>Beste deal nu</p>
        <p className={styles.bestDealFallbackValue}>Nog niet nagekeken</p>
        <p className={styles.bestDealMeta}>
          We hebben nog geen scherpe winkelvergelijking voor deze set.
        </p>
      </Surface>
    );
  }

  return (
    <Surface
      as="section"
      className={styles.bestDealCard}
      elevation="floating"
      tone="accent"
    >
      <p className={styles.bestDealEyebrow}>Beste deal nu</p>
      <p className={styles.bestDealPrice}>{bestDeal.price}</p>
      <p className={styles.bestDealMeta}>{bestDeal.merchantLabel}</p>
      <div className={styles.bestDealSignals}>
        <Badge tone="neutral">{bestDeal.stockLabel}</Badge>
        <p className={styles.bestDealChecked}>{bestDeal.checkedLabel}</p>
      </div>
      {bestDeal.ctaHref && bestDeal.ctaLabel ? (
        <ActionLink
          className={styles.bestDealAction}
          href={bestDeal.ctaHref}
          rel="noreferrer sponsored"
          target="_blank"
          tone="accent"
        >
          {bestDeal.ctaLabel}
        </ActionLink>
      ) : null}
    </Surface>
  );
}

function CatalogSetPriceAlertCard({ action }: { action?: ReactNode }) {
  return (
    <Surface
      as="section"
      className={styles.alertCard}
      elevation="rested"
      tone="muted"
    >
      <p className={styles.alertEyebrow}>Prijsalert</p>
      <h2 className={styles.alertTitle}>Nog even wachten?</h2>
      <p className={styles.alertCopy}>
        Krijg een seintje zodra de prijs zakt of er een betere deal staat.
      </p>
      {action ? <div className={styles.alertAction}>{action}</div> : null}
    </Surface>
  );
}

function CatalogSetOfferCoverageCard() {
  return (
    <Surface
      as="section"
      className={styles.offerCoverageCard}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading
        eyebrow="Meer prijzen"
        title="Nog geen echte vergelijking"
      />
      <p className={styles.offerCoverageCopy}>
        We volgen nu 1 winkel voor deze set. Zodra er meer prijzen zijn, zie je
        hier de vergelijking.
      </p>
    </Surface>
  );
}

function CatalogSetOfferList({
  offers,
}: {
  offers: readonly CatalogSetDetailOfferItem[];
}) {
  if (offers.length === 0) {
    return null;
  }

  if (offers.length === 1) {
    return <CatalogSetOfferCoverageCard />;
  }

  return (
    <Surface
      as="section"
      className={styles.offerListCard}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading eyebrow="Meer winkels" title="Meer nagekeken prijzen" />
      <div className={styles.offerList}>
        {offers.map((offer) => (
          <article
            className={styles.offerRow}
            key={`${offer.merchantLabel}-${offer.price}`}
          >
            <div className={styles.offerCopy}>
              <div className={styles.offerTitleRow}>
                <p className={styles.offerMerchant}>{offer.merchantLabel}</p>
                {offer.isBest ? <Badge tone="accent">Beste deal</Badge> : null}
                <Badge tone="neutral">{offer.stockLabel}</Badge>
              </div>
              <p className={styles.offerMeta}>{offer.checkedLabel}</p>
            </div>
            <div className={styles.offerSide}>
              <p className={styles.offerPrice}>{offer.price}</p>
              <ActionLink
                className={styles.offerAction}
                href={offer.ctaHref}
                rel="noreferrer sponsored"
                target="_blank"
                tone="secondary"
              >
                {offer.ctaLabel}
              </ActionLink>
            </div>
          </article>
        ))}
      </div>
    </Surface>
  );
}

function CatalogSetOwnershipCard({ action }: { action?: ReactNode }) {
  if (!action) {
    return null;
  }

  return (
    <Surface
      as="section"
      className={styles.ownershipCard}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading
        description="Vink deze set af als hij al op je plank staat."
        eyebrow="Je collectie"
        title="Al in huis?"
      />
      <div className={styles.ownershipAction}>{action}</div>
    </Surface>
  );
}

function CatalogSetTrustSignals({
  trustSignals,
}: {
  trustSignals: readonly CatalogSetDetailTrustSignal[];
}) {
  if (trustSignals.length === 0) {
    return null;
  }

  return (
    <Surface
      as="section"
      className={styles.trustCard}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading eyebrow="Vertrouwen" title="Waar dit op steunt" />
      <dl className={styles.trustGrid}>
        {trustSignals.map((trustSignal) => (
          <div className={styles.trustItem} key={trustSignal.label}>
            <dt className={styles.supportingLabel}>{trustSignal.label}</dt>
            <dd className={styles.trustValue}>{trustSignal.value}</dd>
          </div>
        ))}
      </dl>
    </Surface>
  );
}

export function CatalogSetDetailPanel({
  bestDeal,
  catalogSetDetail,
  dealVerdict,
  offerList = [],
  ownershipActions,
  priceAlertAction,
  priceHistoryPanel,
  themeDirectoryHref,
  themeHref,
  trustSignals = [],
}: {
  bestDeal?: CatalogSetDetailBestDeal;
  catalogSetDetail: CatalogSetDetail;
  dealVerdict: CatalogSetDetailVerdict;
  offerList?: readonly CatalogSetDetailOfferItem[];
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

  return (
    <section className={styles.detailPage}>
      <nav aria-label="Setcontext" className={styles.contextRow}>
        {themeDirectoryHref ? (
          <ActionLink
            className={styles.contextLink}
            href={themeDirectoryHref}
            tone="inline"
          >
            Thema's
          </ActionLink>
        ) : (
          <span className={styles.contextCurrent}>Thema's</span>
        )}
        <span aria-hidden="true" className={styles.contextDivider}>
          /
        </span>
        {themeHref ? (
          <ActionLink
            className={styles.contextLink}
            href={themeHref}
            tone="inline"
          >
            <CatalogCanonicalText>
              {catalogSetDetail.theme}
            </CatalogCanonicalText>
          </ActionLink>
        ) : (
          <span className={styles.contextCurrent}>
            <CatalogCanonicalText>
              {catalogSetDetail.theme}
            </CatalogCanonicalText>
          </span>
        )}
        <span aria-hidden="true" className={styles.contextDivider}>
          /
        </span>
        <span aria-current="page" className={styles.contextCurrent}>
          Setdetail
        </span>
      </nav>
      <Surface
        as="section"
        className={styles.detailHero}
        elevation="floating"
        tone="default"
      >
        <div className={styles.detailHeroGallery}>
          <CatalogSetImageGallery catalogSetDetail={catalogSetDetail} />
        </div>
        <div className={styles.detailHeroContent}>
          <div className={styles.detailHeroHeader}>
            <div className={styles.badgeRow}>
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
            </div>
            <h1 className={styles.detailTitle}>
              <CatalogCanonicalText>
                {catalogSetDetail.name}
              </CatalogCanonicalText>
            </h1>
            <p className={styles.detailPitch}>{catalogSetDetail.tagline}</p>
            <div
              className={styles.detailVerdictBlock}
              data-tone={dealVerdict.tone ?? 'neutral'}
            >
              <p className={styles.detailVerdictKicker}>{dealVerdict.label}</p>
              <p className={styles.detailVerdict}>{dealVerdict.explanation}</p>
            </div>
            <p className={styles.heroMeta}>
              Set {catalogSetDetail.id} · {catalogSetDetail.releaseYear}
            </p>
          </div>
          <CatalogSetBestDealCard bestDeal={bestDeal} />
          <CatalogSetPriceAlertCard action={priceAlertAction} />
        </div>
      </Surface>

      <CatalogSetOfferList offers={offerList} />

      {priceHistoryPanel ? (
        <section className={styles.detailPricingStack}>
          {priceHistoryPanel}
        </section>
      ) : null}

      <section className={styles.detailInfoGrid}>
        <Surface
          as="aside"
          className={styles.notesPanel}
          elevation="rested"
          tone="muted"
        >
          <div className={styles.notesHeader}>
            <SectionHeading
              description={catalogSetDetail.collectorAngle}
              eyebrow="Waarom deze set"
              title="Wat opvalt"
              titleAs="h2"
            />
          </div>
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
          <ul className={styles.highlightsList}>
            {setHighlights.map((collectorHighlight) => (
              <li key={collectorHighlight}>{collectorHighlight}</li>
            ))}
          </ul>
        </Surface>
        <Surface
          as="aside"
          className={styles.notesPanel}
          elevation="rested"
          tone="muted"
        >
          <div className={styles.notesHeader}>
            <SectionHeading
              description="Kort en alleen wat helpt bij kiezen."
              eyebrow="Specs"
              title="Snel gecheckt"
              titleAs="h2"
            />
          </div>
          <CatalogSetMetadata
            className={styles.detailSpecsGrid}
            items={[
              {
                label: 'Steentjes',
                value: catalogSetDetail.pieces.toLocaleString(),
              },
              {
                label: 'Minifiguren',
                value: formatMinifigureCount(catalogSetDetail.minifigureCount),
              },
              { label: 'Jaar', value: catalogSetDetail.releaseYear },
              ...(setStatusLabel
                ? [
                    {
                      label: 'Status',
                      value: setStatusLabel,
                    },
                  ]
                : []),
            ]}
          />
          <p className={styles.specNote}>
            Leeftijd en afmetingen volgen zodra ze lokaal zijn toegevoegd.
          </p>
        </Surface>
      </section>
      <CatalogSetTrustSignals trustSignals={trustSignals} />
      <CatalogSetOwnershipCard action={ownershipActions} />
    </section>
  );
}

export function CatalogThemeHighlight({
  className,
  href,
  imageUrl,
  themeSnapshot,
  variant = 'default',
  visual,
}: {
  className?: string;
  href?: string;
  imageUrl?: string;
  themeSnapshot: CatalogThemeSnapshot;
  variant?: 'default' | 'feature' | 'portrait';
  visual?: CatalogThemeVisual;
}) {
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
            '--theme-muted': `color-mix(in srgb, ${visual.textColor} 72%, transparent)`,
            '--theme-shadow': `color-mix(in srgb, ${visual.textColor} 12%, transparent)`,
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
            '--theme-muted': `color-mix(in srgb, ${visual.textColor} 78%, transparent)`,
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
