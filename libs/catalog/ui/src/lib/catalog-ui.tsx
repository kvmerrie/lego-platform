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
  imageUrl,
  name,
  setId,
  theme,
  variant,
}: {
  imageUrl?: string;
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
            alt={`${name} LEGO-set`}
            className={styles.setImage}
            decoding="async"
            loading={variant === 'hero' ? 'eager' : 'lazy'}
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

export function CatalogSetDetailPanel({
  catalogSetDetail,
  productSummary,
  supportingPanel,
  themeDirectoryHref,
  themeHref,
}: {
  catalogSetDetail: CatalogSetDetail;
  productSummary?: ReactNode;
  supportingPanel?: ReactNode;
  themeDirectoryHref?: string;
  themeHref?: string;
}) {
  const setStatusLabel = formatCatalogSetStatus(catalogSetDetail.setStatus);
  const minifigureHighlightsLabel = formatMinifigureHighlights(
    catalogSetDetail.minifigureHighlights,
  );

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
        className={styles.productHero}
        elevation="floating"
        tone="default"
      >
        <div className={styles.productMedia}>
          <CatalogSetVisual
            imageUrl={catalogSetDetail.imageUrl}
            name={catalogSetDetail.name}
            setId={catalogSetDetail.id}
            theme={catalogSetDetail.theme}
            variant="hero"
          />
        </div>
        <div className={styles.productInfo}>
          <div className={styles.heroCopy}>
            <SectionHeading
              description={catalogSetDetail.tagline}
              eyebrow="Setdetail"
              title={
                <CatalogCanonicalText>
                  {catalogSetDetail.name}
                </CatalogCanonicalText>
              }
              titleAs="h1"
              tone="display"
            />
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
            </div>
            <p className={styles.heroMeta}>
              {catalogSetDetail.releaseYear} · {catalogSetDetail.priceRange}
            </p>
          </div>
          {productSummary ? (
            <div className={styles.productSummarySlot}>{productSummary}</div>
          ) : null}
        </div>
      </Surface>

      <section
        className={`${styles.supportingRow} ${
          supportingPanel ? '' : styles.supportingRowSingle
        }`}
      >
        <Surface
          as="aside"
          className={styles.notesPanel}
          elevation="rested"
          tone="muted"
        >
          <div className={styles.notesHeader}>
            <SectionHeading
              description="De belangrijkste productfeiten en verzamelcontext die tellen voordat je prijzen vergelijkt."
              eyebrow="Setdetails"
              title="Wat LEGO-fans meestal eerst checken"
              titleAs="h3"
            />
          </div>
          <CatalogSetMetadata
            className={styles.detailSpecsGrid}
            items={[
              { label: 'Setnummer', value: catalogSetDetail.id },
              {
                label: 'Thema',
                value: (
                  <CatalogCanonicalText>
                    {catalogSetDetail.theme}
                  </CatalogCanonicalText>
                ),
              },
              ...(catalogSetDetail.subtheme
                ? [
                    {
                      label: 'Subthema',
                      value: (
                        <CatalogCanonicalText>
                          {catalogSetDetail.subtheme}
                        </CatalogCanonicalText>
                      ),
                    },
                  ]
                : []),
              { label: 'Releasejaar', value: catalogSetDetail.releaseYear },
              ...(setStatusLabel
                ? [
                    {
                      label: 'Status',
                      value: setStatusLabel,
                    },
                  ]
                : []),
              {
                label: 'Steentjes',
                value: catalogSetDetail.pieces.toLocaleString(),
              },
              {
                label: 'Minifiguren',
                value: formatMinifigureCount(catalogSetDetail.minifigureCount),
              },
            ]}
          />
          <div className={styles.detailCollectorContext}>
            {minifigureHighlightsLabel ? (
              <CatalogSupportingDetail
                label="Bevat"
                value={
                  <CatalogCanonicalText>
                    {minifigureHighlightsLabel}
                  </CatalogCanonicalText>
                }
              />
            ) : null}
            <CatalogSupportingDetail
              label="Verzamelaarsblik"
              value={catalogSetDetail.collectorAngle}
            />
            <CatalogSupportingDetail
              label="Beschikbaarheid"
              value={catalogSetDetail.availability}
            />
          </div>
          {catalogSetDetail.collectorHighlights.length > 0 ? (
            <ul className={styles.highlightsList}>
              {catalogSetDetail.collectorHighlights.map(
                (collectorHighlight) => (
                  <li key={collectorHighlight}>{collectorHighlight}</li>
                ),
              )}
            </ul>
          ) : null}
        </Surface>
        {supportingPanel}
      </section>
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
            <span className={styles.themeFeatureAction}>Bekijk alle sets</span>
          </div>
          <h3 className={styles.themeFeatureTitle}>
            <CatalogCanonicalText>{themeSnapshot.name}</CatalogCanonicalText>
          </h3>
          <p className={styles.themeFeatureCopy}>{themeSnapshot.momentum}</p>
          <p className={styles.themeFeatureSignature}>
            Kijk eerst naar{' '}
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
