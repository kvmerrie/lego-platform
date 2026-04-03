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

type CatalogSetCardVariant = 'compact' | 'default' | 'featured';
type CatalogSetSavedState = 'owned' | 'wishlist';

function getSavedStateBadgeTone(
  savedState: CatalogSetSavedState,
): ComponentProps<typeof Badge>['tone'] {
  return savedState === 'owned' ? 'positive' : 'neutral';
}

function getSavedStateLabel(savedState: CatalogSetSavedState): string {
  return savedState === 'owned' ? 'Owned' : 'In wishlist';
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
            alt={`${name} LEGO set`}
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
      <Badge tone="accent">{theme}</Badge>
      <p className={styles.visualFallbackTitle}>
        Official image not published yet
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
  value: string;
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
  items: Array<{ label: string; value: string | number }>;
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
    return 'Not tracked locally yet';
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
    return 'Available now';
  }

  if (setStatus === 'backorder') {
    return 'Back order';
  }

  if (setStatus === 'retiring_soon') {
    return 'Retiring soon';
  }

  return 'Retired';
}

function formatMinifigureHighlights(
  minifigureHighlights?: readonly string[],
): string | undefined {
  return minifigureHighlights?.length
    ? minifigureHighlights.join(', ')
    : undefined;
}

export function CatalogSetCard({
  href,
  priceContext,
  savedState,
  setSummary,
  supportingNote,
  variant = 'default',
}: {
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  savedState?: CatalogSetSavedState;
  setSummary: CatalogSetCardSummary;
  supportingNote?: string;
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
            <Badge tone="accent">{setSummary.theme}</Badge>
            {savedState ? (
              <Badge tone={getSavedStateBadgeTone(savedState)}>
                {getSavedStateLabel(savedState)}
              </Badge>
            ) : null}
          </div>
          <h3 className={styles.cardTitle}>{setSummary.name}</h3>
          <p className={styles.cardBrowseSupporting}>
            {supportingNote ?? setSummary.tagline ?? setSummary.collectorAngle}
          </p>
          <div className={styles.cardCompactFooter}>
            <p className={styles.cardCompactMeta}>
              {setSummary.releaseYear} · {setSummary.priceRange}
            </p>
            {href ? (
              <span className={styles.cardCompactAction}>Open set</span>
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
            <Badge tone="accent">{setSummary.theme}</Badge>
            {savedState ? (
              <Badge tone={getSavedStateBadgeTone(savedState)}>
                {getSavedStateLabel(savedState)}
              </Badge>
            ) : null}
          </div>
          <h3 className={styles.cardTitle}>{setSummary.name}</h3>
          <div className={styles.priceCompactBlock}>
            <p className={styles.priceLabel}>Reviewed price</p>
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
                  Reviewed price not published yet
                </p>
                <p className={styles.cardCompactSupporting}>
                  {supportingNote ?? 'Set page is live.'}
                </p>
              </>
            )}
          </div>
          <div className={styles.cardCompactFooter}>
            <p className={styles.cardCompactMeta}>
              {priceContext ? priceContext.reviewedLabel : 'Set page live'}
            </p>
            {href ? (
              <span className={styles.cardCompactAction}>Open set</span>
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
          <Badge tone="accent">{setSummary.theme}</Badge>
          {savedState ? (
            <Badge tone={getSavedStateBadgeTone(savedState)}>
              {getSavedStateLabel(savedState)}
            </Badge>
          ) : null}
          <p className={styles.cardMetaText}>
            {setSummary.releaseYear} · {setSummary.priceRange}
          </p>
        </div>
        <h3 className={styles.cardTitle}>{setSummary.name}</h3>
        <p className={styles.cardTagline}>
          {setSummary.tagline ?? setSummary.collectorAngle}
        </p>
      </div>
      {priceContext ? (
        <div className={styles.priceBlock}>
          <p className={styles.priceLabel}>Reviewed price</p>
          <p className={styles.priceValue}>{priceContext.currentPrice}</p>
          <p className={styles.priceMeta}>{priceContext.merchantLabel}</p>
          {priceContext.pricePositionLabel ? (
            <p className={styles.pricePosition}>
              {priceContext.pricePositionLabel}
            </p>
          ) : null}
          <div className={styles.supportingGrid}>
            <CatalogSupportingDetail
              label="Coverage"
              value={priceContext.coverageLabel}
            />
            <CatalogSupportingDetail
              label="Freshness"
              value={priceContext.reviewedLabel}
            />
          </div>
        </div>
      ) : (
        <div className={styles.priceBlock}>
          <p className={styles.priceLabel}>Reviewed price</p>
          <p className={styles.priceUnavailableCopy}>
            Reviewed price not published yet.
          </p>
        </div>
      )}
      <div className={styles.collectorContext}>
        <CatalogSupportingDetail
          label="Why collectors like it"
          value={setSummary.collectorAngle}
        />
        {setSummary.availability ? (
          <CatalogSupportingDetail
            label="Availability"
            value={setSummary.availability}
          />
        ) : null}
      </div>
      <CatalogSetMetadata
        items={[
          { label: 'Pieces', value: setSummary.pieces.toLocaleString() },
          { label: 'Release', value: setSummary.releaseYear },
          { label: 'Range', value: setSummary.priceRange },
        ]}
      />
      {href ? (
        <ActionLink className={styles.actionLink} href={href} tone="secondary">
          See set
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
      <nav aria-label="Set context" className={styles.contextRow}>
        {themeDirectoryHref ? (
          <ActionLink
            className={styles.contextLink}
            href={themeDirectoryHref}
            tone="inline"
          >
            Themes
          </ActionLink>
        ) : (
          <span className={styles.contextCurrent}>Themes</span>
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
            {catalogSetDetail.theme}
          </ActionLink>
        ) : (
          <span className={styles.contextCurrent}>
            {catalogSetDetail.theme}
          </span>
        )}
        <span aria-hidden="true" className={styles.contextDivider}>
          /
        </span>
        <span aria-current="page" className={styles.contextCurrent}>
          Set detail
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
              eyebrow="Set detail"
              title={catalogSetDetail.name}
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
                  <Badge tone="accent">{catalogSetDetail.theme}</Badge>
                </ActionLink>
              ) : (
                <Badge tone="accent">{catalogSetDetail.theme}</Badge>
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
              description="Core product facts and the collector context that matter before you compare prices."
              eyebrow="Set details"
              title="What LEGO fans usually check first"
              titleAs="h3"
            />
          </div>
          <CatalogSetMetadata
            className={styles.detailSpecsGrid}
            items={[
              { label: 'Set number', value: catalogSetDetail.id },
              { label: 'Theme', value: catalogSetDetail.theme },
              ...(catalogSetDetail.subtheme
                ? [{ label: 'Subtheme', value: catalogSetDetail.subtheme }]
                : []),
              { label: 'Release year', value: catalogSetDetail.releaseYear },
              ...(setStatusLabel
                ? [
                    {
                      label: 'Status',
                      value: setStatusLabel,
                    },
                  ]
                : []),
              {
                label: 'Pieces',
                value: catalogSetDetail.pieces.toLocaleString(),
              },
              {
                label: 'Minifigures',
                value: formatMinifigureCount(catalogSetDetail.minifigureCount),
              },
            ]}
          />
          <div className={styles.detailCollectorContext}>
            {minifigureHighlightsLabel ? (
              <CatalogSupportingDetail
                label="Includes"
                value={minifigureHighlightsLabel}
              />
            ) : null}
            <CatalogSupportingDetail
              label="Collector take"
              value={catalogSetDetail.collectorAngle}
            />
            <CatalogSupportingDetail
              label="Availability"
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
              alt={`${themeSnapshot.signatureSet} LEGO set`}
              className={styles.themePortraitImage}
              decoding="async"
              loading="lazy"
              src={portraitImageUrl}
            />
          </div>
        ) : null}
        <div className={styles.themePortraitBody}>
          <h3 className={styles.themePortraitTitle}>{themeSnapshot.name}</h3>
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
              alt={`${themeSnapshot.signatureSet} LEGO set`}
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
              {themeSnapshot.setCount} tracked sets
            </p>
            <span className={styles.themeFeatureAction}>Open theme page</span>
          </div>
          <h3 className={styles.themeFeatureTitle}>{themeSnapshot.name}</h3>
          <p className={styles.themeFeatureCopy}>{themeSnapshot.momentum}</p>
          <p className={styles.themeFeatureSignature}>
            Start with {themeSnapshot.signatureSet}
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
        <Badge tone="accent">{themeSnapshot.name}</Badge>
        <h3 className={styles.cardTitle}>{themeSnapshot.signatureSet}</h3>
      </div>
      <p className={styles.mutedCopy}>{themeSnapshot.momentum}</p>
      <Badge tone="info">{themeSnapshot.setCount} tracked sets</Badge>
    </Surface>
  );
}

export function CatalogUi() {
  return (
    <Surface as="section" className={styles.demo} tone="muted">
      <SectionHeading
        description="Presentational building blocks for set discovery and detail storytelling."
        eyebrow="Catalog UI"
        title="Retail-grade catalog surfaces with collector-friendly metadata."
      />
    </Surface>
  );
}

export default CatalogUi;
