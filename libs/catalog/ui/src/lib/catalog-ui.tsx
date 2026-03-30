import type { ReactNode } from 'react';
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

export interface CatalogSetCardPriceContext {
  coverageLabel: string;
  currentPrice: string;
  merchantLabel: string;
  pricePositionLabel?: string;
  pricePositionTone?: CatalogSetCardPriceContextTone;
  reviewedLabel: string;
}

type CatalogSetCardVariant = 'default' | 'featured';

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
        <img
          alt={`${name} set`}
          className={styles.setImage}
          decoding="async"
          loading={variant === 'hero' ? 'eager' : 'lazy'}
          src={imageUrl}
        />
      </div>
    );
  }

  return (
    <div className={`${visualClassName} ${styles.visualFallback}`}>
      <Badge tone="accent">{theme}</Badge>
      <p className={styles.visualFallbackTitle}>Collector image coming soon</p>
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
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <dl className={styles.metaGrid}>
      {items.map((item) => (
        <div className={styles.metaItem} key={item.label}>
          <dt className={styles.metaLabel}>{item.label}</dt>
          <dd className={styles.metaValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CatalogSetCard({
  href,
  priceContext,
  setSummary,
  variant = 'default',
}: {
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  setSummary: CatalogSetCardSummary;
  variant?: CatalogSetCardVariant;
}) {
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
              </>
            ) : (
              <>
                <p className={styles.priceUnavailableValue}>
                  Not published yet
                </p>
                <p className={styles.cardCompactSupporting}>
                  Reviewed pricing is live for selected sets.
                </p>
              </>
            )}
          </div>
          <div className={styles.cardCompactFooter}>
            <p className={styles.cardCompactMeta}>
              {priceContext ? priceContext.reviewedLabel : 'Public set page'}
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
        <div className={styles.cardBadgeRow}>
          <Badge tone="accent">{setSummary.theme}</Badge>
          <Badge tone="info">{setSummary.releaseYear}</Badge>
        </div>
        <h3 className={styles.cardTitle}>{setSummary.name}</h3>
        <p className={styles.cardTagline}>
          {setSummary.tagline ?? setSummary.collectorAngle}
        </p>
      </div>
      {priceContext ? (
        <div className={styles.priceBlock}>
          <div className={styles.priceHeader}>
            <p className={styles.priceLabel}>Reviewed price</p>
            {priceContext.pricePositionLabel ? (
              <Badge tone={priceContext.pricePositionTone ?? 'info'}>
                {priceContext.pricePositionLabel}
              </Badge>
            ) : null}
          </div>
          <p className={styles.priceValue}>{priceContext.currentPrice}</p>
          <p className={styles.priceMeta}>{priceContext.merchantLabel}</p>
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
          <div className={styles.priceHeader}>
            <p className={styles.priceLabel}>Reviewed price</p>
            <Badge tone="neutral">Not published yet</Badge>
          </div>
          <p className={styles.priceUnavailableCopy}>
            Reviewed pricing is live for selected sets.
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

export function CatalogHomepageIntro() {
  return (
    <Surface
      as="section"
      className={styles.heroPanel}
      elevation="floating"
      tone="default"
    >
      <div className={styles.heroPrimary}>
        <SectionHeading
          description="Start with a small curated shortlist, then open set pages for pricing context and private saves."
          eyebrow="Curated discovery"
          title="A collector-friendly way to browse standout sets."
          tone="hero"
        />
        <div className={styles.badgeRow}>
          <Badge tone="accent">Static-friendly reads</Badge>
          <Badge tone="info">Private saves</Badge>
        </div>
      </div>
      <div className={styles.heroSecondary}>
        <SectionHeading
          description="The homepage stays light and browse-first while set pages carry the deeper collector tools."
          eyebrow="Focused scope"
          title="A small slice that already feels useful."
          titleAs="h2"
        />
        <ActionLink
          className={styles.actionLink}
          href="#featured-sets"
          tone="accent"
        >
          Browse featured sets
        </ActionLink>
      </div>
    </Surface>
  );
}

export function CatalogSetDetailPanel({
  catalogSetDetail,
  homeHref,
  productSummary,
  supportingPanel,
}: {
  catalogSetDetail: CatalogSetDetail;
  homeHref?: string;
  productSummary?: ReactNode;
  supportingPanel?: ReactNode;
}) {
  return (
    <section className={styles.detailPage}>
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
              eyebrow="Curated set"
              title={catalogSetDetail.name}
              titleAs="h2"
              tone="hero"
            />
            <div className={styles.badgeRow}>
              <Badge tone="accent">{catalogSetDetail.theme}</Badge>
              <Badge>{catalogSetDetail.releaseYear}</Badge>
              <Badge tone="info">{catalogSetDetail.priceRange}</Badge>
            </div>
          </div>
          {productSummary ? (
            <div className={styles.productSummarySlot}>{productSummary}</div>
          ) : null}
          {homeHref ? (
            <ActionLink
              className={styles.productBackLink}
              href={homeHref}
              tone="secondary"
            >
              Back to shortlist
            </ActionLink>
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
              description={catalogSetDetail.collectorAngle}
              eyebrow="Collector notes"
              title="Why this set stands out"
              titleAs="h3"
            />
            <p className={styles.availability}>
              Availability: {catalogSetDetail.availability}
            </p>
          </div>
          <CatalogSetMetadata
            items={[
              { label: 'Set number', value: catalogSetDetail.id },
              { label: 'Release', value: catalogSetDetail.releaseYear },
              {
                label: 'Pieces',
                value: catalogSetDetail.pieces.toLocaleString(),
              },
              {
                label: 'Price range',
                value: catalogSetDetail.priceRange,
              },
            ]}
          />
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
  themeSnapshot,
}: {
  themeSnapshot: CatalogThemeSnapshot;
}) {
  return (
    <Surface as="article" className={styles.themeCard} tone="muted">
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
