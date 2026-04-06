import type { CSSProperties, ComponentProps, ReactNode } from 'react';
import type {
  CatalogHomepageSetCard,
  CatalogSetDetail,
  CatalogSetSummary,
  CatalogThemeSnapshot,
} from '@lego-platform/catalog/util';
import { normalizeCatalogSetImages } from '@lego-platform/catalog/util';
import { Blocks, CalendarDays, Hash, Package2, UsersRound } from 'lucide-react';
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
  LabelValue,
  LabelValueList,
  MarkerList,
  Panel,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
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
  merchantLabel: string;
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

function getFeaturedCardReason({
  collectorAngle,
  supportingNote,
  tagline,
}: {
  collectorAngle?: string;
  supportingNote?: ReactNode;
  tagline?: string;
}): ReactNode {
  return supportingNote ?? collectorAngle ?? tagline;
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
              {setSummary.releaseYear} ·{' '}
              {setSummary.pieces.toLocaleString('nl-NL')} stenen
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
    const featuredIntroCopy = getFeaturedCardReason({
      collectorAngle: setSummary.collectorAngle,
      supportingNote,
      tagline: setSummary.tagline,
    });
    const featuredFooterMeta = priceContext
      ? `${priceContext.coverageLabel} · ${priceContext.reviewedLabel}`
      : `${setSummary.releaseYear} · ${setSummary.pieces.toLocaleString(
          'nl-NL',
        )} stenen`;

    const featuredCardContent = (
      <>
        <CatalogSetVisual
          imageUrl={setSummary.imageUrl}
          name={setSummary.name}
          setId={setSummary.id}
          theme={setSummary.theme}
          variant="card"
        />
        <div className={`${styles.cardCompactBody} ${styles.featuredCardBody}`}>
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
          {featuredIntroCopy ? (
            <p
              className={`${styles.cardBrowseSupporting} ${styles.cardFeaturedSupporting}`}
            >
              {featuredIntroCopy}
            </p>
          ) : null}
          <div className={styles.priceCompactBlock}>
            {priceContext ? (
              <>
                {priceContext.pricePositionLabel ? (
                  <p
                    className={`${styles.cardCompactSignal} ${getPricePositionClassName(
                      priceContext.pricePositionTone,
                    )}`}
                  >
                    {priceContext.pricePositionLabel}
                  </p>
                ) : null}
                <p className={styles.priceValue}>{priceContext.currentPrice}</p>
                <p className={styles.cardCompactSupporting}>
                  {priceContext.merchantLabel}
                </p>
              </>
            ) : (
              <p className={styles.priceQuietState}>Prijs volgt</p>
            )}
          </div>
          <div className={styles.cardCompactFooter}>
            <div className={styles.cardCompactFooterMeta}>
              <p className={styles.cardCompactMeta}>{featuredFooterMeta}</p>
            </div>
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
        {actions ? (
          <div className={styles.cardCompactSecondaryRow}>{actions}</div>
        ) : null}
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
            {setSummary.releaseYear} ·{' '}
            {setSummary.pieces.toLocaleString('nl-NL')} stenen
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

function getCatalogGalleryImages(
  catalogSetDetail: Pick<
    CatalogSetDetail,
    'imageUrl' | 'images' | 'primaryImage'
  >,
): string[] {
  return (
    normalizeCatalogSetImages({
      imageUrl: catalogSetDetail.imageUrl,
      images: catalogSetDetail.images,
      primaryImage: catalogSetDetail.primaryImage,
    }).images?.map((catalogSetImage) => catalogSetImage.url) ?? []
  );
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
  const heroSpecs: CatalogKeyFact[] = [
    {
      id: 'set-number',
      icon: <Hash aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Setnummer',
      value: <CatalogCanonicalText>{catalogSetDetail.id}</CatalogCanonicalText>,
    },
    {
      id: 'release-year',
      icon: <CalendarDays aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Jaar',
      value: catalogSetDetail.releaseYear,
    },
    {
      id: 'piece-count',
      icon: <Blocks aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Stenen',
      value: catalogSetDetail.pieces.toLocaleString('nl-NL'),
    },
    {
      id: 'minifigures',
      icon: <UsersRound aria-hidden="true" size={17} strokeWidth={2.2} />,
      label: 'Minifiguren',
      value: formatMinifigureCount(catalogSetDetail.minifigureCount),
    },
    ...(setStatusLabel
      ? [
          {
            id: 'status',
            icon: <Package2 aria-hidden="true" size={17} strokeWidth={2.2} />,
            label: 'Status',
            value: setStatusLabel,
          },
        ]
      : []),
  ];

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
            leadWithFollow={dealVerdict.tone === 'warning'}
            primaryOffer={bestDeal}
            supportItems={dealSupportItems}
            supportTitle={getCatalogDecisionSupportTitle(dealVerdict)}
            verdictTone={dealVerdict.tone}
          />
        }
        gallery={<CatalogSetImageGallery catalogSetDetail={catalogSetDetail} />}
        keyFacts={<CatalogKeyFacts items={heroSpecs} />}
        pitch={catalogSetDetail.tagline}
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
          title="Wat opvalt"
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
        eyebrow="Waarom Brickhunt"
        items={brickhuntValueItems}
        title="Waarom via Brickhunt"
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
