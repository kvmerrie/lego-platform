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
}: {
  href?: string;
  priceContext?: CatalogSetCardPriceContext;
  setSummary: CatalogSetCardSummary;
}) {
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
            <p className={styles.priceLabel}>Reviewed Dutch price</p>
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
            <p className={styles.priceLabel}>Reviewed Dutch price</p>
            <Badge tone="neutral">Not published yet</Badge>
          </div>
          <p className={styles.priceUnavailableCopy}>
            This set is in the public catalog now. Reviewed Dutch pricing is
            only published for selected sets in the current slice.
          </p>
        </div>
      )}
      <div className={styles.collectorContext}>
        <CatalogSupportingDetail
          label="Collector angle"
          value={setSummary.collectorAngle}
        />
        {setSummary.availability ? (
          <CatalogSupportingDetail
            label="Availability posture"
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
          Open set page
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
      padding="lg"
      tone="accent"
    >
      <div className={styles.heroPrimary}>
        <SectionHeading
          description="The homepage stays intentionally small: a short introduction, a curated featured list, and detail routes powered by stable catalog contracts."
          eyebrow="Catalog discovery"
          title="Browse a focused first slice of the LEGO collector experience."
          tone="hero"
        />
        <div className={styles.badgeRow}>
          <Badge tone="accent">Static-friendly reads</Badge>
          <Badge tone="info">Library-driven composition</Badge>
        </div>
      </div>
      <div className={styles.heroSecondary}>
        <SectionHeading
          description="Keep the homepage read-focused while the detail routes prove the first session-backed collector actions."
          eyebrow="Phase-1 scope"
          title="A narrow slice built for confidence."
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
}: {
  catalogSetDetail: CatalogSetDetail;
  homeHref?: string;
}) {
  return (
    <section className={styles.heroPanel}>
      <Surface
        as="section"
        className={styles.heroPrimary}
        elevation="floating"
        padding="lg"
        tone="accent"
      >
        <div className={styles.heroPrimaryContent}>
          <div className={styles.heroCopy}>
            <SectionHeading
              description={catalogSetDetail.tagline}
              eyebrow="Set detail"
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
          <CatalogSetVisual
            imageUrl={catalogSetDetail.imageUrl}
            name={catalogSetDetail.name}
            setId={catalogSetDetail.id}
            theme={catalogSetDetail.theme}
            variant="hero"
          />
        </div>
        <CatalogSetMetadata
          items={[
            { label: 'Set number', value: catalogSetDetail.id },
            {
              label: 'Pieces',
              value: catalogSetDetail.pieces.toLocaleString(),
            },
            {
              label: 'Collector angle',
              value: catalogSetDetail.collectorAngle,
            },
          ]}
        />
        {homeHref ? (
          <ActionLink
            className={styles.actionLink}
            href={homeHref}
            tone="secondary"
          >
            Back to curated browse
          </ActionLink>
        ) : null}
      </Surface>
      <Surface
        as="aside"
        className={styles.highlightsCard}
        elevation="rested"
        tone="muted"
      >
        <div className={styles.cardHeader}>
          <Badge tone="info">Collector highlights</Badge>
          <p className={styles.availability}>
            Availability: {catalogSetDetail.availability}
          </p>
        </div>
        <ul className={styles.highlightsList}>
          {catalogSetDetail.collectorHighlights.map((collectorHighlight) => (
            <li key={collectorHighlight}>{collectorHighlight}</li>
          ))}
        </ul>
      </Surface>
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
